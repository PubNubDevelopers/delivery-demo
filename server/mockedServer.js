/**
 * The functionality that this JS file provides would be most sensibly provided by
 * a server, however to keep everything self-contained and to simplify the demo
 * the server functionality will all be handled in the client
 */

//  Entry function when the user presses one of the 'deliver xxx' buttons
async function server_summonVehicle (location, theme, themeSpecificData) {
  //  Called in response to the summon vehicle button.  Args contains a lat / long position of the location to deliver to
  //  Spawn a delivery vehicle at a random position between a predescribed number of km from the delivery location.
  //  (Obviously in reality this step would involve finding a nearby driver etc. etc.)
  var spawnLocation = server_generateDeliveryVehicleLocation(location)

  //  Determine the route between the vehicle and the delivery location
  var route = await server_generateRouteInfo(spawnLocation, location)

  //  Reduce the number of lat / longs if needed
  //  The maximum message size of a PubNub message is 32KiB.  Best practice if you are sending large messages is to calculate the payload
  //  size and chunk as required: https://support.pubnub.com/hc/en-us/articles/360051495932-Calculating-message-payload-size-before-publishing
  //  For simplicity, this app will just throw away some of the intermediate points if the route is too large
  var reducedRoute = []
  while (route.length > 300) {
    reducedRoute = []
    reducedRoute.push(route[0])
    //  Keep the start and end few locations
    for (var i = 1; i < route.length - 2; i++) {
      if (i % 2 == 0) reducedRoute.push(route[i])
    }
    reducedRoute.push(route[route.length - 1])
    route = reducedRoute
  }

  //  In production, the driver's vehicle will report their position, likely through an
  //  app on the driver's phone (that uses the PubNub client).  We simulate that with a web worker
  server_spawnVehicleSimulator(route, theme, themeSpecificData)
}

//  Use the Google Geocoding API to resolve the manually entered address to a lat/long
async function server_resolveAddressToLatLong (address) {
  return new Promise(resolve => {
    geocoder = new google.maps.Geocoder()
    geocoder.geocode({ address: address }, function (results, status) {
      if (status == 'OK') {
        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng()
        })
      } else {
        console.log(
          'Geocode was not successful for the following reason: ' + status
        )
        resolve(null)
      }
    })
  })
}

//  Use the Google Directions API to generate a route (we are only interested in the list of lat/long waypoints)
//  Given two locations.  The directions API is much more powerful than this but this is not a demo of Google's API
async function server_generateRouteInfo (origin, destination) {
  //  args are lat,lng pairs
  var sourceLatLng = origin.lat + ',' + origin.lng
  var destLatLng = destination.lat + ',' + destination.lng

  return new Promise(resolve => {
    var directionsService = new google.maps.DirectionsService()
    directionsService.route(
      {
        origin: sourceLatLng,
        destination: destLatLng,
        travelMode: 'DRIVING' //  Just assume all these routes will be driving, nothing to stop us using PubNub for cycle-based deliveries etc.
      },
      function (response, status) {
        if (
          status === 'OK' &&
          response.routes.length > 0 &&
          response.routes[0].legs[0].steps.length > 0
        ) {
          //  Iterate over all the latlngs in all the steps and create
          var route = []
          for (
            var step = 0;
            step < response.routes[0].legs[0].steps.length;
            step++
          ) {
            for (
              var latlng = 0;
              latlng < response.routes[0].legs[0].steps[step].lat_lngs.length;
              latlng++
            ) {
              var newLatLong = {
                lat: response.routes[0].legs[0].steps[step].lat_lngs[
                  latlng
                ].lat(),
                lng: response.routes[0].legs[0].steps[step].lat_lngs[
                  latlng
                ].lng()
              }
              route.push(newLatLong)
            }
          }
          //  route now contains an array of lat/long waypoints between the start and end points, inclusive.
          resolve(route)
        }
      }
    )
  })
}

//  We want to spawn a delivery vehicle at a random position between x and y km from the
//  delivery location, where x and y are configurable.  Assume the earth is a perfect sphere.
//  Return a new lat/long the specified distance away from the passed lat/long
function server_generateDeliveryVehicleLocation (location) {
  var randomAzimuthInDegrees = Math.floor(Math.random() * 359)
  var randomDistanceInMeters =
    Math.floor(Math.random() * maximumSpawnDistanceOfDriver) +
    minimumSpawnDistanceOfDriver
  var northDisplacement =
    randomDistanceInMeters *
    (Math.cos((Math.PI / 180) * randomAzimuthInDegrees) / 111111)
  var eastDisplacement =
    (randomDistanceInMeters *
      Math.sin((Math.PI / 180) * randomAzimuthInDegrees)) /
    Math.cos((Math.PI / 180) * location.lat) /
    111111
  var newLatitude = location.lat + northDisplacement
  var newLongitude = location.lng + eastDisplacement
  newLatitude = Math.round((newLatitude + Number.EPSILON) * 10000000) / 10000000
  newLongitude =
    Math.round((newLongitude + Number.EPSILON) * 10000000) / 10000000
  return { lat: newLatitude, lng: newLongitude }
}

//  In production, this code simulates a vehicle reporting its position through PubNub
//  This is implemented in a web worker for convenience - it means the demo is self-contained
//  Without having to worry about spinning up any serverless code to get things working.
function server_spawnVehicleSimulator (route, theme, themeSpecificData) {
  var simulatorTask = new Worker('./server/simulation/worker_vehiclesim.js')
  var vehicleId = 'sim_' + makeid(6)
  simulatorTask.postMessage({
    action: 'go',
    params: {
      id: vehicleId,
      channel: channelName,
      route: route,
      theme: theme,
      themeSpecificData: themeSpecificData,
      sub: subscribe_key,
      pub: publish_key
    }
  })
}
