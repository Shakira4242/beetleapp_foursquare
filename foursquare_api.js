var fetch = require('node-fetch')

// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = 'ACda04405f0b9725e854d6e81596d25921';
const authToken = 'db766cb8f0ab0adb391d44affd576e40';
const client = require('twilio')(accountSid, authToken);


// const response = fetch("https://api.foursquare.com/v3/places/search?query=pizza&ll=29.55252517029129%2C-98.58001073342784&exclude_all_chains=true&fields=tel&open_now=true",{
// 	headers: {
//         'Authorization': 'fsq3o47jScjItaE4VTeKhb94sVHf98CbLpTNx1gmkm9KNFA=',
//         'Content-Type': 'application/json'
//     }
// })

const open_ai_update = async (text, prompt_name, phone_number) => {

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
				{ prompt: new_prompt.prompt + " CUSTOMER: "  + text, phone_number: phone_number, name: new_prompt.name  },
			])
  
			if (error) {
				console.log(error)
			} else {
				console.log("new prompt created")
				open_ai_prompt = new_prompt.prompt
			}
		}
	}
}  


const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bpeqsefkefhjnfshvrck.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwZXFzZWZrZWZoam5mc2h2cmNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NzE2NjAwNjAsImV4cCI6MTk4NzIzNjA2MH0.Wlq3HSKyUIRxSSv-Qm16L8prX8JrSe23NI7eYjACIAw')

let from = '+3109874586'
let phone_list = ['+12107128563']

function updateState(){
	for (var i = phone_list.length - 1; i >= 0; i--) {

		let to = phone_list[i]

		// phone number from +12107128563 to 2107128563
		let phone_number = to.substring(2, to.length)

		console.log(phone_number)

		// supabase search for phone number

		let message = null

		supabase.from('Outreach').select('potential_text, notification_phone_number, first_lead_phone_number').eq('business_phone', phone_number).then(({ data, error }) => {
			console.log(data[0].potential_text);
			message = data[0].potential_text;

			let messaging_from = "+1" + data[0].notification_phone_number

			console.log(messaging_from);

			console.log(data[0].potential_text);

			// remove last four digits of phone number
			let first_lead_phone_number_blanked = data[0].first_lead_phone_number.substring(0, 3) + "-" + data[0].first_lead_phone_number.substring(3, data[0].first_lead_phone_number.length - 4) + "-" + "****"

			const notification_message = " Hello.\n\n" + first_lead_phone_number_blanked + " reached out your business over text. \n\nSign up for free to get their full phone number. \n\ncalljoy.xyz/login"

			text(from, to, messaging_from, notification_message);

			// (async()=> {await open_ai_update(message, "text_reply", to)})();
		})
	}
}

function call(from, to){
	client.calls.create({
		statusCallback: 'https://cancel-call-3677.twil.io/path_1',
		statusCallbackEvent: ['ringing'],
		twiml: '<Response></Response>',
		from: from,
		to: to
	})
}

function text(from, to, messaging_from, message){
	setTimeout(function() {	
		console.log(message)

		client.messages.create({
			body: message,
			from: messaging_from,
			to: to
		});
	}, 1000);
}

updateState();