var fetch = require('node-fetch')

// Download the helper library from https://www.twilio.com/docs/node/install
// Find your Account SID and Auth Token at twilio.com/console
// and set the environment variables. See http://twil.io/secure
const accountSid = 'ACda04405f0b9725e854d6e81596d25921';
const authToken = 'a4267aca11aa44d37ee3648d09e1f4a7';
const client = require('twilio')(accountSid, authToken);


// const response = fetch("https://api.foursquare.com/v3/places/search?ll=29.55252517029129%2C-98.58001073342784&radius=8000&categories=11071",{
// 	headers: {
//         'Authorization': 'fsq3o47jScjItaE4VTeKhb94sVHf98CbLpTNx1gmkm9KNFA=',
//         'Content-Type': 'application/json'
//     }
// })

// response.then((data)=>{
// 	return data.json()
// }).then((res_json)=>{
// 	res_json.results.map((item, idx)=>{
// 		// console.log(item["fsq_id"])

// 		const place_details = fetch("https://api.foursquare.com/v3/places/" + item["fsq_id"] + "?fields=tel", {
// 			headers: {
// 				'Authorization': 'fsq3o47jScjItaE4VTeKhb94sVHf98CbLpTNx1gmkm9KNFA=',
//         		'Content-Type': 'application/json'
// 			}
// 		})

// 		place_details.then((place_details_data)=>{
// 			return place_details_data.json()
// 		}).then((place_data)=>{
// 			console.log(place_data)
// 		})
// 	})
// })

client.calls
.create({
 url: 'https://calls.vetrun.ngrok.io/twiml',
 from: '+12107960644',
 to: '+12106478000'
})
.then(call => console.log(call.sid));