/**
 * Web worker to represent a simulated vehicle.
 * Although the vehicle is simulated, all communication between the simulator and the dashboard is over the (external) PubNub network.
 */

//  A Web worker is used so we can keep all the functionality in the client for ease of demonstration.  In production, the logic implemented
//  by this web worker will be hosted in the customer's server environment
if ('function' === typeof importScripts) {
  const window = null
  importScripts('https://cdn.pubnub.com/sdk/javascript/pubnub.7.2.1.min.js')
  importScripts('../../js/theme.js')
  importScripts('./names.js')

  var sharedChannelName
  var id
  var route
  var theme
  var themeSpecificData
  var localPubNub
  var tick = 0
  var intervalId

  //  When initiated, this web worker will iterate over all lat/long elements in the provided
  //  route and send each update over PubNub to the receiving dashboard
  onmessage = async function (args) {
    if (args.data.action === 'go') {
      id = args.data.params.id
      sharedChannelName = args.data.params.channel
      route = args.data.params.route
      theme = args.data.params.theme
      themeSpecificData = args.data.params.themeSpecificData

      //  Pub / Sub key will be shared with the PubNub instance used by the dashboard, defined in keys.js
      var subKey = args.data.params.sub
      var pubKey = args.data.params.pub
      localPubNub = new PubNub({
        publishKey: pubKey,
        subscribeKey: subKey,
        uuid: id,
        listenToBrowserNetworkEvents: false //  Allows us to call the PubNub SDK from a web worker
      })

      await localPubNub.addListener({
        status: async statusEvent => {
          //console.log(statusEvent)
        },
        message: async payload => {
          //  Received a message from the client intended for the driver
          //  display that message on the map, beside the vehicle
          //  This means sending the data back over PubNub
          if (payload.publisher !== id) {
            if (payload.message == '\n\n') {
              //  Clear current map
              await localPubNub.publish({
                channel: sharedChannelName,
                message: {
                  state: 'CLEAR_INFO_WINDOW'
                }
              })
            } else {
              await localPubNub.publish({
                channel: sharedChannelName,
                message: {
                  state: 'ADD_INFO_WINDOW',
                  data: payload.message
                }
              })
            }
          }
        }
      })

      await localPubNub.subscribe({
        channels: [id], //  To communicate directly with this vehicle, use the id as the channel name.  Used in the 'send message to driver' logic
        withPresence: false
      })

      vehicleSimulator = new VehicleSimulator(
        route,
        simulationInterval,
        theme,
        themeSpecificData
      )
      vehicleSimulator.start()
    }
  }

  class VehicleSimulator {
    interval

    constructor (route, simulationInterval, theme, themeSpecificData) {
      this.interval = simulationInterval
      this.route = route
      this.theme = theme
      this.themeSpecificData = themeSpecificData

      //  Generate some random information associated with the delivery
      var randomGender = Math.floor(Math.random() * 2) + 1
      var randomPerson = Math.floor(Math.random() * 99) + 1
      var randomRating = Math.floor(Math.random() * 4) + 7 //  I felt bad for the people given 1 star so everyone gets a minimum of 7 / 10 (3.5 stars)
      var randomCar = Math.floor(Math.random() * 13) + 1
      var randomRegistration = ''
      //  Absolutely no attempt to create a sensible registration (license) plate based on the user's region(!)
      for (var i = 0; i < 7; i++) {
        randomRegistration += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(
          Math.floor(Math.random() * 36)
        )
      }
      //  All names and profile images are open source in this simulation
      var driverName
      var profileUrl = './server/simulation/img/'
      if (randomGender == 1) {
        profileUrl += 'male/'
        driverName = names_male[randomPerson - 1]
      } else {
        profileUrl += 'female/'
        driverName = names_female[randomPerson - 1]
      }
      profileUrl += randomPerson + '.jpg'
      //  Generate some specific data to the theme to make the experience feel more interactive.  Not all data might be used in all themes.
      themeSpecificData.generated = {}
      themeSpecificData.generated.driverName = driverName
      themeSpecificData.generated.driverProfileUrl = profileUrl
      themeSpecificData.generated.driverRating = randomRating
      themeSpecificData.generated.vehicleRegistration = randomRegistration
      if (theme == THEME_TAXI)
        themeSpecificData.generated.vehicleModel = themeSpecificData.vehicleType
      else themeSpecificData.generated.vehicleModel = names_cars[randomCar]
    }

    start () {
      this.publishMessage(
        localPubNub,
        sharedChannelName,
        this.route,
        this.theme,
        this.themeSpecificData
      )
      intervalId = setInterval(
        this.publishMessage,
        this.interval,
        localPubNub,
        sharedChannelName,
        this.route,
        this.theme,
        this.themeSpecificData
      )
    }

    stop () {
      clearInterval(intervalId)
    }

    toString () {
      return this.id + ' [' + this.latitude + ', ' + this.longitude + ']'
    }

    async publishMessage (
      localPubNub,
      channelName,
      route,
      theme,
      themeSpecificData
    ) {
      if (tick === route.length) {
        //  Notify the dashboard that the entire route has been walked
        await localPubNub.publish({
          channel: channelName,
          message: {
            state: 'END_ROUTE'
          }
        })
        clearInterval(intervalId)
        return
      }

      if (route[tick] == null) return

      //  I sometimes saw the Google results coming back with lat / longs with crazy precisions.
      var localLatitude = route[tick].lat
      localLatitude =
        Math.round((localLatitude + Number.EPSILON) * 10000000) / 10000000
      var localLongitude = route[tick].lng
      localLongitude =
        Math.round((localLongitude + Number.EPSILON) * 10000000) / 10000000

      if (tick === 0) {
        //  Notify the dashboard that we are sending a new route.  This will be the FIRST time the
        //  dashboard learns that there is a vehicle en route.
        await localPubNub.publish({
          channel: channelName,
          message: {
            state: 'START_ROUTE',
            lat: localLatitude,
            lng: localLongitude,
            theme: theme,
            themeSpecificData: themeSpecificData,
            route: route
          }
        })
      } else if (tick < route.length) {
        //  Send a signal if it is just a postional update.  This is more efficient with these high volume, small data transfers
        await localPubNub.signal({
          channel: channelName,
          message: {
            lat: localLatitude,
            lng: localLongitude,
            tick: tick
          }
        })
      }
      tick++
    }
  }
}
