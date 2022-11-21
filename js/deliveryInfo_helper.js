/**
 * Helper functions for the Delivery Information Pane
 */

var userLocation = null

//  Top level function to handle the buttons that initiate a delivery
async function summonVehicle (theme) {
  //  Rate limit the speed that vehicles can be summoned (directions api is rate limited)
  document.getElementById('btnSummonPackageDelivery').disabled = true
  document.getElementById('btnSummonTaxi').disabled = true
  document.getElementById('btnSummonFoodDelivery').disabled = true
  setTimeout(
    "document.getElementById('btnSummonPackageDelivery').disabled = false;document.getElementById('btnSummonTaxi').disabled = false;document.getElementById('btnSummonFoodDelivery').disabled = false",
    2000
  )

  //  Determine what the user has asked to be ordered.  The theme is determined by which button the user pressed
  var themeSpecificData = {}
  if (theme === THEME_PACKAGE_DELIVERY) {
    var order1 = document.getElementById('chkPackage1').checked
    var order2 = document.getElementById('chkPackage2').checked
    var order3 = document.getElementById('chkPackage3').checked
    var countOrders = 0
    if (order1) countOrders++
    if (order2) countOrders++
    if (order3) countOrders++
    if (countOrders == 0) {
      displayError('Please select at least one package to deliver')
      return
    }
    themeSpecificData.numOrders = countOrders
  } else if (theme === THEME_TAXI) {
    var taxi1 = document.getElementById('chkTaxi1').checked
    var taxi2 = document.getElementById('chkTaxi2').checked
    var taxi3 = document.getElementById('chkTaxi3').checked
    var vehicleType = document.getElementById('lblTaxi1').innerHTML
    if (taxi2) vehicleType = document.getElementById('lblTaxi2').innerHTML
    if (taxi3) vehicleType = document.getElementById('lblTaxi3').innerHTML
    themeSpecificData.vehicleType = vehicleType
  } else if (theme === THEME_FOOD_DELIVERY) {
    var food1 = document.getElementById('chkFood1').checked
    var food2 = document.getElementById('chkFood2').checked
    var food3 = document.getElementById('chkFood3').checked
    themeSpecificData.foodType = []
    if (food1)
      themeSpecificData.foodType.push(
        document.getElementById('lblFood1').innerHTML
      )
    if (food2)
      themeSpecificData.foodType.push(
        document.getElementById('lblFood2').innerHTML
      )
    if (food3)
      themeSpecificData.foodType.push(
        document.getElementById('lblFood3').innerHTML
      )
    if (themeSpecificData.foodType.length == 0) {
      displayError('Please select at least one type of food to deliver')
      return
    }
  }

  //  Determine where the package is being delivered to.  Either the user's physical location or whichever address they have typed into the manual address field.
  var deliveryLocation = null
  if (userLocation != null) {
    //  Using physical lat / long of the user for delivery location
    server_summonVehicle(userLocation, theme, themeSpecificData)
  } else if (
    userLocation === null &&
    !document.getElementById('chkFindMyLocation').checked
  ) {
    //  Using manual address that the user has typed in.  Will need to geocode this address to convert it to a lat/long
    var manualAddress = document.getElementById('txtManualAddress').value
    if (manualAddress == '') {
      displayError('You have not specified a delivery address')
      return
    } else if (manualAddress.length > 7500) {
      //  Google API has a maximum query length of 8192
      displayError('The specified delivery address is too long')
      return
    }

    //  Geocode the manual address to a lat/long
    deliveryLocation = await server_resolveAddressToLatLong(manualAddress)
    if (deliveryLocation == null) {
      displayError(
        'Unable to resolve delivery address, please try a different address'
      )
    } else {
      successfullySummonedVehicle(theme)  //  Only used for the interactive demo
      server_summonVehicle(deliveryLocation, theme, themeSpecificData)
    }
  } else {
    //  Unrecognised location
    displayError('Please wait until your location has been determined')
  }
}

//  Only used for the interactive demo
function successfullySummonedVehicle (theme) {
  if (theme === THEME_PACKAGE_DELIVERY) {
    actionCompleted({ action: 'Request a Package Delivery', debug: false }) //  Only used for interactive demo
  } else if (theme === THEME_TAXI) {
    actionCompleted({ action: 'Order a Taxi', debug: false }) //  Only used for interactive demo
  } else if (theme === THEME_FOOD_DELIVERY) {
    actionCompleted({ action: 'Order some Food', debug: false }) //  Only used for interactive demo
  }
}

//  Handler for the checkbox the user taps to find their physical location.
function handleChkFindMyLocation () {
  var chk = document.getElementById('chkFindMyLocation')
  if (chk.checked) {
    //  Find current location
    if (navigator.geolocation) {
      enableManualAddressField(false)
      navigator.geolocation.getCurrentPosition(
        handlePosition,
        findMyLocationFailed
      )
      updateLocationSpan('Pending...')
    } else {
      //  Browser does not support navigator object
      findMyLocationFailed(error.POSITION_UNAVAILABLE)
    }
  } else {
    //  Do not find current location, manually type address
    enableManualAddressField(true)
    updateLocationSpan('')
    hideUserLocationMarker()
    userLocation = null
  }
}

//  When the user's physical location is found, this function handles the successful return of the user's lat/long
function handlePosition (position) {
  userLocation = {
    lat: position.coords.latitude,
    lng: position.coords.longitude
  }
  //updateLocationSpan("[" + position.coords.latitude + ", " + position.coords.longitude + "]");
  updateLocationSpan('User Found')
  zoomOnPosition(userLocation)
  showUserLocationMarker(userLocation)
}

//  Handler for when some issue happens retrieving the user's physical location.  Just present the error to the user and allow them to enter the address manually instead.
function findMyLocationFailed (error) {
  document.getElementById('chkFindMyLocation').checked = false
  enableManualAddressField(true)
  userLocation = null
  switch (error.code) {
    case error.PERMISSION_DENIED:
      updateLocationSpan('User denied the request for Geolocation.')
      break
    case error.POSITION_UNAVAILABLE:
      updateLocationSpan('Location information is unavailable.')
      break
    case error.TIMEOUT:
      updateLocationSpan('Location information is unavailable.')
      break
    case error.UNKNOWN_ERROR:
      updateLocationSpan('An unknown error occurred.')
      break
  }
}

//  Show or hide the field for user's to enter a manual address (not based on their physical location)
function enableManualAddressField (bEnable) {
  if (bEnable)
    document.getElementById('liManualAddress').style.display = 'block'
  else document.getElementById('liManualAddress').style.display = 'none'
}

function updateLocationSpan (newText) {
  document.getElementById('spanDetectedLocation').innerText = newText
}

//  Some error has occurred, either retrieving the user's location or their order is incorrect (e.g. food order contains no items)
function displayError (errorMessage) {
  console.log('Error: ' + errorMessage)
  var errorModal = new bootstrap.Modal(
    document.getElementById('errorModal'),
    {}
  )
  document.getElementById('errorModalMessage').innerHTML = errorMessage
  errorModal.show()
}
