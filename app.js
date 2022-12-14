// port

const HTTP_SERVER_PORT = process.env.PORT || 8080;

// server requirements

var http = require("http");
var HttpDispatcher = require("httpdispatcher");
var WebSocketServer = require("websocket").server;
var dispatcher = new HttpDispatcher();
var wsserver = http.createServer(handleRequest);

var save_recording = require('./components/save_recording.js')

const accountSid = 'ACda04405f0b9725e854d6e81596d25921';
const authToken = 'e0c8694200fb493efefdaad75b938bec';
const client = require('twilio')(accountSid, authToken);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bpeqsefkefhjnfshvrck.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZXFzZWZrZWZoam5mc2h2cmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY2NTAwNDY2MywiZXhwIjoxOTgwNTgwNjYzfQ.5lJMLZYF4Gqpryidn1xL91Fjqk-btWn258lDg_cOscU')

// twilio streams save audio

const TwilioMediaStreamSaveAudioFile = require("twilio-media-stream-save-audio-file");

const mediaStreamSaver = new TwilioMediaStreamSaveAudioFile({
  saveLocation: './',
  saveFilename: "my-twilio-media-stream-output",
  onSaved: () => {
    const file_name = new Date().toISOString() + '.wav'
    save_recording(file_name, phone_number);
  },
});

// audio file stuff

const wavefile = require('wavefile');
const fs = require("fs");
const path = require("path");
const FileWriter = require('wav').FileWriter

const REPEAT_THRESHOLD = 50;

let phone_number = null

// media websocket

var mediaws = new WebSocketServer({
  httpServer: wsserver,
  autoAcceptConnections: true,
});
const stream = require('node:stream');

// Deepgram audio transcription

const { Deepgram } = require('@deepgram/sdk')
const deepgram = new Deepgram('6d576c95ecd084248541b0eb7111d813c8a32be2');
let deepgramLive = null

// aws text-to-speech

const AWS = require('aws-sdk')
AWS.config = new AWS.Config();
AWS.config.accessKeyId = "AKIA44RSULSZ3TTXSZHG";
AWS.config.secretAccessKey = "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";
AWS.config.region = "us-east-1";
const Polly = new AWS.Polly({
    signatureVersion: 'v4',
    region: 'us-east-1'
});

// setup routes

function handleRequest(request, response) {
  try {
    dispatcher.dispatch(request, response);
  } catch (err) {
    console.error(err);
  }
}

function decodeQueryParam(p) {
  return decodeURIComponent(p.replace(/\+/g, ' '));
}

dispatcher.onPost("/twiml", function (req, res) {
  console.log("POST TwiML");

  phone_number = req.params.From

  var filePath = path.join(__dirname + "/templates", "streams.xml");
  var stat = fs.statSync(filePath);

  res.writeHead(200, {
    "Content-Type": "text/xml",
    "Content-Length": stat.size,
  });

  var readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
});

dispatcher.onPost("/sms", function (req, res) {
  console.log("POST sms");

  phone_number = req.params.From

  console.log(req.params.Body);

  (async ()=> {
    const reply = await openai_reply(req.params.Body, "text_reply"); 

    console.log(reply)

    client.messages 
    .create({         
      to: phone_number,
      body: reply,
      from: '+12107960644'
    })
    .then(message => console.log(message.sid)) 
    .done();

    res.writeHead(200, {
      "Content-Type": "text/xml",
    });

  })();
});

mediaws.on("connect", function (connection) {
  mediaStreamSaver.setWebsocket(connection)
  console.log("From Twilio: Connection accepted");
  new MediaStream(connection);
});

// Generate audio from Polly and check if output is a Buffer

const generatePollyAudio = (text) => {
  const params = {
    Engine: 'neural',
    VoiceId: 'Matthew',
    TextType: 'text',
    OutputFormat: 'pcm',
    Text: text,
  };

  return Polly.synthesizeSpeech(params).promise().then( audio => {
    if (audio.AudioStream instanceof Buffer) {
      return audio
    }
    else throw 'AudioStream is not a Buffer.'
  })
}

// reply in real time

const reply = async (streamSid, text, connection) => {
  console.log("generating audio " + text)

  const audio_data = await generatePollyAudio(text)

  function bufferToStream(binary) {
    const readableInstanceStream = new stream.Readable({
      read() {
          this.push(binary);
          this.push(null);
      }
    });
    return readableInstanceStream;
  }

  let audioStream = bufferToStream(audio_data.AudioStream);

  const file_name = "something.wav"

  var outputFileStream = new FileWriter(file_name, 
    {
      sampleRate: 16000,
      channels: 1
    }
  );

  audioStream.pipe(outputFileStream);

  console.log('not finished')

  outputFileStream.on('end', function(){ 
    console.log('finished')

    let wav = new wavefile.WaveFile(fs.readFileSync("./" + file_name.toString()))

    wav.toSampleRate(8000)
    wav.toMuLaw()

    let payload = Buffer.from(wav.data.samples).toString("base64");

    const message = {
      event: "media",
      streamSid,
      media: {
        "payload": payload,
      },
    };

    const messageJSON = JSON.stringify(message);
    connection.sendUTF(messageJSON)
  });
}

// openAI config

const { Configuration, OpenAIApi } = require("openai");
const { time } = require("console");
const configuration = new Configuration({
    organization: "org-7g9rQ6W0fcmPsZsU4tnUdlnf",
    apiKey: "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",
});
const openai = new OpenAIApi(configuration);

// helper open ai function

const openai_reply = async (text, saved_prompt) => {
  if(saved_prompt){    
    let { data: Prompts, error } = await supabase
    .from('Prompts')
    .select("*")
    .eq('name', saved_prompt)
    .single()

    if(error){
      console.log(error);
    }else{
      const saved_prompt = Prompts.prompt

      console.log(saved_prompt + "\n" + text)

      const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: saved_prompt + text + "\n",
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });
      
      console.log(response.data.choices[0].text);
      return response.data.choices[0].text;
    } 
  }else{
    console.log("no saved prompt");
  }
}

class MediaStream {
  constructor(connection) {
    this.connection = connection;
    connection.on("message", this.processMessage.bind(this));
    connection.on("close", this.close.bind(this));
    this.hasSeenMedia = false;
    this.messages = [];
    this.repeatCount = 0;
    this.streamSid = null;
  }

  processMessage(message) {
    if (message.type === "utf8") {
      var data = JSON.parse(message.utf8Data);

      if (data.event === "connected") {
        console.log("From Twilio: Connected event received: ", data);
      }

      if (data.event === "start") { 
        mediaStreamSaver.twilioStreamStart()

        console.log("From Twilio: Start event received: ", data);

        const streamSid = data.start.streamSid

        let message = true

        const connection = this.connection;

        deepgramLive = deepgram.transcription.live({
          punctuate: true,
          language: 'en',
          model: 'phonecall',
          encoding: 'mulaw',
          sample_rate: 8000,
          endpointing: true,
          diarize: true,
          multichannel: true,
        });

        // Listen for the connection to close
        deepgramLive.addListener('close', (data) => {
          for (var key in data) {
            console.log(key + " " + data[key]);
          }

          console.log('Connection closed.')
        });

        deepgramLive.addListener('error', (error) => {
          console.log(error);
        });


        // Listen for any transcripts received from Deepgram
        deepgramLive.addListener('transcriptReceived', (transcription) => {
          // parse transcript 
          const transcript = JSON.parse(transcription);

          // check if transcript has a chanel and the transcript isn't empty
          if (transcript.hasOwnProperty('channel') && transcript.channel.alternatives[0].transcript !== null ) {
            if(transcript.channel.alternatives[0].transcript !== ""){

              console.log(transcript)

              // get current date and time
              const date = new Date();
              const readable_date = date.toDateString();
              const readable_time = date.toTimeString();

              (async()=>{
                // get open ai response
                const response = await openai_reply(transcript.channel.alternatives[0].transcript, "call_reply")
                
                // send a text message with a transcript 

                console.log(phone_number)

                client.messages
                .create({
                  body: "You said:" + transcript.channel.alternatives[0].transcript,
                  from: '+12107960644',
                  to: phone_number,
                })
                .then(message => console.log(message.sid));

                await reply(streamSid, response ,connection)
              })();
            }
          }
        });
      }

      if (data.event === "media") {
        mediaStreamSaver.twilioStreamMedia(data.media.payload)

        // if (!this.hasSeenMedia) {
        //   console.log("From Twilio: Media event received: ", data);
        //   console.log("Server: Suppressing additional messages...");
        //   this.hasSeenMedia = true;
        // }
        // Store media messages
        // this.messages.push(data);
        // if (this.messages.length >= REPEAT_THRESHOLD) {
        //   console.log(`From Twilio: ${this.messages.length} omitted media messages`);
        //   this.repeat();
        // }

        // check for ready state
        if(deepgramLive.getReadyState() == 1){

          // convert mulaw to base64 byte array
          const results = Buffer.from(data.media.payload, 'base64')

          // send byte array to deepgram socket
          deepgramLive.send(results)
        }
      }

      if (data.event === "mark") {
        console.log("From Twilio: Mark event received", data);
      }

      if (data.event === "close") {
        console.log("From Twilio: Close event received: ", data);
        this.close();
      }
    } else if (message.type === "binary") {
      console.log("From Twilio: binary message received (not supported)");
    }
  }

  close() {
    mediaStreamSaver.twilioStreamStop();
    console.log("Server: Closed");
  }
}

wsserver.listen(HTTP_SERVER_PORT, function () {
  console.log("Server listening on: http://localhost:%s", HTTP_SERVER_PORT);
});