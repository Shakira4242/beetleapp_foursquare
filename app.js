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
const authToken = process.env.TWILIO_SECRET_KEY;
const client = require('twilio')(accountSid, authToken);

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bpeqsefkefhjnfshvrck.supabase.co', process.env.SUPABASE_PUBLIC_KEY)

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

let text_back_number = null

// media websocket

var mediaws = new WebSocketServer({
  httpServer: wsserver,
  autoAcceptConnections: true,
});
const stream = require('node:stream');

// Deepgram audio transcription

const { Deepgram } = require('@deepgram/sdk')
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
let deepgramLive = null

// aws text-to-speech

const AWS = require('aws-sdk')
AWS.config = new AWS.Config();
AWS.config.accessKeyId = "AKIA5N2COANFWBESIKHN";
AWS.config.secretAccessKey = process.env.AWS_SECRET_KEY;
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

  phone_number = req.params.To
  text_back_number = req.params.From

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

  console.log(req.params.Body);

  (async ()=> {
    const reply = await openai_reply(req.params.Body, "text_reply", phone_number);

    // console.log(reply);

    client.messages 
    .create({         
      to: req.params.From,
      body: reply,
      from: req.params.To
    })
    .then(message => console.log(message.sid)) 
    .done();
  })();

  res.writeHead(200, {
    "Content-Type": "text/xml",
  });
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
    apiKey: process.env.OPEN_API_KEY,
});
const openai = new OpenAIApi(configuration);

// helper open ai function

const openai_reply = async (text, prompt_name, phone_number) => {

  let open_ai_prompt = null

  // check if updated prompt exists

  let { data: updated_prompt, error } = await supabase
    .from('Chats')
    .select('*')
    .eq('phone_number', phone_number)
    .single()

  if(error){

    // if not create a new prompt from supabase
    let { data: new_prompt, error } = await supabase
    .from('Prompts')
    .select('*')
    .eq('name', prompt_name)
    .single()

    // then return the prompt
    if (error) {
      console.log(error)
    } else {
      // create new prompts in Chat table
      let { data: _, error } = await supabase
      .from('Chats')
      .insert([
        { prompt: new_prompt.prompt, phone_number: phone_number, name: new_prompt.name  },
      ])

      if (error) {
        console.log(error)
      } else {
        console.log("new prompt created")

        open_ai_prompt = new_prompt.prompt
      }
    }
  }else if (updated_prompt){
    // if updated prompt exists return it
    open_ai_prompt = updated_prompt.prompt
  }

  // open ai request
  const new_prompt = open_ai_prompt + "\n" + text + "\n"

  console.log('prompt: ' + new_prompt)

  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: new_prompt,
    temperature: 0.7,
    max_tokens: 200,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  
  // update prompt in supabase
  let { data: new_updated_prompt, error: update_error } = await supabase
  .from('Chats')
  .update({ prompt: new_prompt + response.data.choices[0].text })
  .eq('phone_number', phone_number)
  
  console.log(response.data.choices[0].text)
  return response.data.choices[0].text;
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
          model: 'conversationalai',
          encoding: 'mulaw',
          sample_rate: 8000,
          endpointing: true,
          diarize: true,
          multichannel: true,
        });

        deepgramLive.addListener('open', (data) => {
          (async()=>{
            let lines = [
              `Hey! Let's get this conversation going over text!`,
              `Hi! Let's text it out instead of talking on the phone!`,
              `Hey! Let's skip the phone call and text it out!`,
              `Hey! It's 2022. Let's text it out!`,
              `Hey. Let's text it out instead of talking on the phone!`,
              `Hey! Let's trade in the phonecall for some texting!`,
              `Talking on the phone? Nah, let's text it out!`,
              `Hey! Let's keep it digital and text it out!`,
              `Hi! Let's chat it out via text instead!`
            ];

            let randomIndex = Math.floor(Math.random() * lines.length);
            let randomLine = lines[randomIndex];

            console.log(randomLine)

            await reply(streamSid, randomLine ,connection);

            client.messages
            .create({
              body: `📱` + text_back_number + ` just called. Message them back sms:` + text_back_number,
              from: '+12107960644',
              to: '+12107128563',
            })
            .then(message => console.log(message.sid));
          })();
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
          if (transcript.hasOwnProperty('channel') && transcript.channel.alternatives[0].transcript !== null && transcript.speech_final == true) {
            if(transcript.channel.alternatives[0].transcript !== ""){

              console.log(transcript);

              (async()=>{
                // get open ai response
                // const response = await openai_reply(transcript.channel.alternatives[0].transcript, "call_reply")

                // send a text message with a transcript 

                console.log(phone_number)

                let lines = [
                  `Hey! Let's get this conversation going over text!`,
                  `Hi! Let's text it out instead of talking on the phone!`,
                  `Hey! Let's skip the phone call and text it out!`,
                  `Hey! It's 2022. Let's text it out!`,
                  `Hey. Let's text it out instead of talking on the phone!`,
                  `Hey! Let's trade in the phonecall for some texting!`,
                  `Talking on the phone? Nah, let's text it out!`,
                  `Hey! Let's keep it digital and text it out!`,
                  `Hi! Let's chat it out via text instead!`
                ];

                let randomIndex = Math.floor(Math.random() * lines.length);
                let randomLine = lines[randomIndex];

                await reply(streamSid, randomLine ,connection)
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