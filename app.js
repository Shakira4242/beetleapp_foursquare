// We need something to gtm
// We're going to use a list of local business from the internet for this.

// We primarily will convey our intent over voice/text
// Actually voice is probably the easiest for our customers so voice it is.

// We will sell voice/ai products over the phone just like we reach
// out to our customers.

// Customers will be able to speak back into the phone and get 
// a fake phone number with a voice that provides:  
// 1. information on general business details
// 2. discounts sales and more
// 3. a way to easily update prices and more

const fs = require("fs");
const path = require("path");
var http = require("http");
var HttpDispatcher = require("httpdispatcher");
var WebSocketServer = require("websocket").server;


var dispatcher = new HttpDispatcher();
var wsserver = http.createServer(handleRequest);

const Ably = require('ably/promises');
const ably = new Ably.Realtime.Promise('ekO-1g.WAVrLw:5qK15Okc6b2WoLqzRdFq7895g10LY6Dfv3ZT_HZ7E94');

(async()=>{await ably.connection.once('connected')})();
console.log('Connected to Ably!');

const channel = ably.channels.get("quickstart");
const response_channel = ably.channels.get("response");

const alawmulaw = require('alawmulaw');

const wavefile = require('wavefile');

const HTTP_SERVER_PORT = 8080;

const FileWriter = require('wav').FileWriter

var mediaws = new WebSocketServer({
  httpServer: wsserver,
  autoAcceptConnections: true,
});

const stream = require('node:stream');

const { v4: uuidv4 } = require('uuid');

var fetch = require('node-fetch')

const { Deepgram } = require('@deepgram/sdk')

const deepgram = new Deepgram('6d576c95ecd084248541b0eb7111d813c8a32be2');

let deepgramLive = null

const convert = require('pcm-convert')

const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
    organization: "org-7g9rQ6W0fcmPsZsU4tnUdlnf",
    apiKey: "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",
});

const openai = new OpenAIApi(configuration);

const AWS = require('aws-sdk')

AWS.config = new AWS.Config();
AWS.config.accessKeyId = "AKIA44RSULSZ3TTXSZHG";
AWS.config.secretAccessKey = "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";
AWS.config.region = "us-east-1";

const Polly = new AWS.Polly({
    signatureVersion: 'v4',
    region: 'us-east-1'
})

function handleRequest(request, response) {
  try {
    dispatcher.dispatch(request, response);
  } catch (err) {
    console.error(err);
  }
}

dispatcher.onGet("/", function(req, res){
  console.log("hello")
})

dispatcher.onPost("/twiml", function (req, res) {
  console.log("POST TwiML");

  var filePath = path.join(__dirname + "/templates", "streams.xml");
  var stat = fs.statSync(filePath);

  res.writeHead(200, {
    "Content-Type": "text/xml",
    "Content-Length": stat.size,
  });

  var readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
});

mediaws.on("connect", function (connection) {
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

        console.log("From Twilio: Start event received: ", data);

        const streamSid = data.start.streamSid

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

        const connection = this.connection;


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

        let count = 0

        // Listen for any transcripts received from Deepgram
        deepgramLive.addListener('transcriptReceived', (transcription) => {
          // parse transcript 
          const transcript = JSON.parse(transcription);

          
          // check if transcript has a chanel and the transcript isn't empty
          if (transcript.hasOwnProperty('channel') && transcript.channel.alternatives[0].transcript !== null ) {
            if(transcript.channel.alternatives[0].transcript !== ""){

              if(count == 0){
                (async()=>{await reply(streamSid, 'What is the price of a double bed today?', connection);})();
                count+=1
              }

              console.log(transcript.channel.alternatives[0])

              // (async()=>{
              //   const dialog_response = await openai.createCompletion({
              //     model: "text-davinci-002",
              //     prompt: "I am a customer service bot. If I don't know the answer I respond with unknown.\nQ:" + transcript.channel.alternatives[0].transcript + "A:",
              //     temperature: 0,
              //     max_tokens: 100,
              //     top_p: 1,
              //     frequency_penalty: 0,
              //     presence_penalty: 0,
              //   });

              //   const openai_answer = dialog_response.data.choices[0].text;

              //   console.log(openai_answer)

              //   await channel.publish('message', {"transcript": transcript, "streamSid": this.streamSid, "ai": openai_answer})
              // })();

            }
          }
        });
      }

      if (data.event === "media") {
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
    console.log("Server: Closed");
    deepgramLive.finish()
  }
}

wsserver.listen(HTTP_SERVER_PORT, function () {
  console.log("Server listening on: http://localhost:%s", HTTP_SERVER_PORT);
});