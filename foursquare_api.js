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

let messaging_from = '+12108791875' 


let from = '+12107563782'
let phone_list = ['+12107128563']

let bot_number = '+12107960644'

let index = 0

function updateState(){
	for (var i = phone_list.length - 1; i >= 0; i--) {

		let to = phone_list[i]

		call(from, to)

		text(from, to, messaging_from)
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

function text(from, to, messaging_from){
	setTimeout(function() {	
		client.messages.create({
			body: `📱` + `A new customer reached out to you from facebook.com. ` + `If you'd like to reach out to them directly text them at sms:` + bot_number,
			from: messaging_from,
			to: to
		});
	}, 5000);
}

updateState();