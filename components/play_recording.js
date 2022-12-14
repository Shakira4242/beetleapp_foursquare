// import fs using require
const fs = require('fs');

// import supabase with require

var SupabaseStorageClient = require('@supabase/storage-js').StorageClient

const STORAGE_URL = 'https://bpeqsefkefhjnfshvrck.supabase.co/storage/v1'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZXFzZWZrZWZoam5mc2h2cmNrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY2NTAwNDY2MywiZXhwIjoxOTgwNTgwNjYzfQ.5lJMLZYF4Gqpryidn1xL91Fjqk-btWn258lDg_cOscU' //! service key, not anon key

const storageClient = new SupabaseStorageClient(STORAGE_URL, {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
})

// list files from supabase
const listFiles = async () => {
    const { data, error } = await storageClient
        .from('calls')
        .list()

    if (error) {
        console.log(error)
    }
    
    console.log(data)
}  


(async()=>{
    await listFiles();
})()

//module.exports = function(name){
//  (async()=> {await uploadFile(fs.readFileSync('/Users/akash/beetleapp_foursquare/my-twilio-media-stream-output.wav'), name);} )();
//}