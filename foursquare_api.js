var fetch = require('node-fetch')

// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = 'SKa80d0d67528bae403195e4e0c662f830';
const authToken = process.env.TWILIO_SECRET_KEY;
const client = require('twilio')(accountSid, authToken);



const response = fetch("https://api.foursquare.com/v3/places/search?query=pizza&ll=29.55252517029129%2C-98.58001073342784&exclude_all_chains=true&fields=tel&open_now=true",{
	headers: {
        'Authorization': 'fsq3o47jScjItaE4VTeKhb94sVHf98CbLpTNx1gmkm9KNFA=',
        'Content-Type': 'application/json'
    }
})


// let phone_list = ['+18005528159']

let index = 0

function updateState(){
	client.calls.create({
		machineDetection: 'Enable',
		AsyncAMD: 'true',
		url: 'https://8260-2603-8081-7001-c8a4-c932-7ae5-66ee-e93f.ngrok.io/twiml',
		from: '+12107960644',
		to: '+12107128563',
	});
}

// channel.subscribe(function (message) {
// 	updateState();
// });

updateState();

// response.then((data)=>{
// 	return data.json()
// }).then((res_json)=>{
// 	// for (var i = res_json.results.length - 1; i >= 0; i--) {

// 	// 	var phone = String(res_json.results[i]['tel']).replace(/\D/g, '');

// 		// client.calls.create({
// 		// 	url: 'http://calls.vetrun.ngrok.io/twiml',
// 		// 	from: '+12107960644',
// 		// 	to: '+1' + phone
// 		// }).then((call) => {
// 		// 	console.log(call.sid)
// 		// });
// 	// }
// });