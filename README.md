# Delivery Demo written in JavaScript

PubNub can enable your delivery application, allowing real-time updates on vehicle location, bidirectional communication between customers and drivers, and notifications so users are always kept up to date. 

PubNub is already used in a variety of delivery use-cases including:

* Package Delivery
* Delivery of Online Food Orders
* Rideshare / Private Taxi Ordering

For information on existing customers and deployments see our [Industry pages for delivery](https://www.pubnub.com/industry/rideshare-taxi-and-food-delivery/).

> This application shows how PubNub can request a delivery or taxi and then provide updates on the delivery / rideshare vehicle's location in real-time.  The vehicle's location and any messages received can be seen simultaneously on multiple devices, powered by PubNub.

![Screenshot](https://raw.githubusercontent.com/PubNubDevelopers/delivery-demo/main/media/screenshot.png)

## Demo

A hosted version of this demo can be found at https://www.pubnub.com/demos/delivery/

## Features

* Communicates over the PubNub network - location updates are sent as [PubNub Signals](https://www.pubnub.com/docs/general/messages/publish#sending-signals) to reduce bandwidth.
* Customer-centric features: Request a package delivery, rideshare / taxi or food delivery.
* Route the (simulated) vehicle and see it's location update in real-time on multiple devices, delivered over the PubNub network.
* Send messages to drivers

## Installing / Getting started

This application is self-contained and can be run entirely from the files contained in this repository (without the need to set up a corresponding server or serverless functions).  **Because the app uses WebWorkers you cannot run it directly from the filesystem, instead use a local server such as [XAMPP](https://www.apachefriends.org/) or [Python](https://docs.python.org/3/library/http.server.html)**.

To run this project yourself you will need a PubNub account and a Google Maps API key.

### Requirements
- [Local web server](https://docs.python.org/3/library/http.server.html)
- [PubNub Account](#pubnub-account) (*Free*)

<a href="https://dashboard.pubnub.com/signup">
	<img alt="PubNub Signup" src="https://i.imgur.com/og5DDjf.png" width=260 height=97/>
</a>

### Get Your PubNub Keys

1. You’ll first need to sign up for a [PubNub account](https://dashboard.pubnub.com/signup/). Once you sign up, you can get your unique PubNub keys from the [PubNub Developer Portal](https://admin.pubnub.com/).

1. Sign in to your [PubNub Dashboard](https://admin.pubnub.com/).

1. Click Apps, then **Create New App**.

1. Give your app a name, and click **Create**.

1. Click your new app to open its settings, then click its keyset.

1. Enable the Presence feature for your keyset.

1. Enable the Stream Controller feature for your keyset.

1. Copy the Publish and Subscribe keys and paste them into your app as specified in the next step.

### Get Your Google API Key

You will need a Google API key that suports the following APIs:

- [Geocoding API](https://developers.google.com/maps/documentation/geocoding/get-api-key)
- [Directions API](https://developers.google.com/maps/documentation/directions/get-api-key)
- [JavaScripts Maps SDK](https://developers.google.com/maps/documentation/javascript/get-api-key)

1. Create an account in Google's Cloud Platform and enable billing

1. Generate a Google API key

1. Enable the above-listed APIs on your key

1. Copy the Google API key and paste it into your application as specified in the next step.

## Building and Running

1. You'll need to run the following commands from your terminal.

1. Clone the GitHub repository.

	```bash
	git clone https://github.com/PubNubDevelopers/delivery-demo.git
	```
1. Navigate to the application directory.

	```bash
	cd delivery-demo
	```

1. Add your PubNub pub/sub keys to `keys.js`

1. Add your Google API key to `keys.js`

1. Run your application from a local server

    ```bash
    (for example)
    python3 -m http.server 8001
    ```

## Contributing
Please fork the repository if you'd like to contribute. Pull requests are always welcome. 

## Further Information

Checkout the following lins for more information on developing IoT solutions with PubNub:

- Rideshare, Taxi & Food Delivery customers and case studies: https://www.pubnub.com/industry/rideshare-taxi-and-food-delivery/

## Architectural Notes

### PubNub Messages and Signals

At the start of the route, the whole route is sent as a PubNub message using `publish()`.  There is a maximum size of 32KiB for each message and since the route can get very large, this application chooses to reduce the fidelity of the route (omitting every other coordinate) until the message size is below the max.  Another choice would have been to chunk the initial route message into multiple messages smaller than 32KiB.

Everytime the vehicle moves a PubNub `signal()` is sent, this is limited to 64 bytes which is easily large enough to accommodate a single lat/long coordinate and are a much more cost-effective way of sending this high-volume data.

### Channel Naming conventions

All communication between the vehicle and the dashboard is on a channel whose name is derived from the URL query string - this allows the same application being launched in another window to retrieve a delivery currently in-progress.  This requires the Message persistence feature since details of the route are only sent at the start of the delivery and PubNub signals are not persisted.

The dashboard will listen for all messages sent to `vehicles.*`, using PubNub's Stream Controller.  This will receive all vehicle updates, including those sent by other users.  Vehicles requested by **other users** will only be shown if requested after your page is loaded. 

Every vehicle is listening on a unique channel and direct communication to a vehicle (e.g. sending a message to a driver), will use `publish()` on that vehicle's unique channel. 
