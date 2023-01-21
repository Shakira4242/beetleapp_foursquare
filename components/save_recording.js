// import fs using require
const fs = require('fs');

const wavefile = require('wavefile');


const accountSid = 'ACda04405f0b9725e854d6e81596d25921';
const authToken = process.env.TWILIO_SECRET_KEY;
const client = require('twilio')(accountSid, authToken);

// import supabase with require

var SupabaseStorageClient = require('@supabase/storage-js').StorageClient
const { createClient } = require('@supabase/supabase-js');

const STORAGE_URL = 'https://bpeqsefkefhjnfshvrck.supabase.co/storage/v1'
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY

const supabase = createClient('https://bpeqsefkefhjnfshvrck.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZXFzZWZrZWZoam5mc2h2cmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY2NTAwNDY2MywiZXhwIjoxOTgwNTgwNjYzfQ.5lJMLZYF4Gqpryidn1xL91Fjqk-btWn258lDg_cOscU')

const storageClient = new SupabaseStorageClient(STORAGE_URL, {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
})

// upload wav file to supabase
const uploadFile = async (file, name, phone) => {
  let wav = new wavefile.WaveFile(file)
  wav.fromMuLaw();

  fs.writeFileSync(name, wav.toBuffer());

  await saveFile(fs.readFileSync('./' + name), name, phone);

  fs.unlinkSync('./' + 'my-twilio-media-stream-output.wav');
  fs.unlinkSync('./' + name);
}

async function saveFile(file, name, phone){
  const { data, error } = await storageClient
  .from('calls')
  .upload(name, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'audio/x-wav',
  })

  const phone_data = await client.lookups
    .phoneNumbers(phone)
    .fetch({ type: 'carrier' });

  const carrier = phone_data.carrier
  console.log(carrier)

  const url = STORAGE_URL + '/object/public/calls/' + data.path

  console.log(url)

  // do not write to leads

  // if(!error){
  //   const { data: something, error } = await supabase
  //   .from('Leads')
  //   .insert({ media: url, phone: phone});
  // }
}

module.exports = function(name, phone){
  (async()=> {await uploadFile(fs.readFileSync('./my-twilio-media-stream-output.wav'), name, phone);} )();
}