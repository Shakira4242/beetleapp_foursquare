// const response = fetch("https://api.foursquare.com/v3/places/search?ll=29.55252517029129%2C-98.58001073342784&radius=8000",{
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