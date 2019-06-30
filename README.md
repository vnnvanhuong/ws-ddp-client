# DDP Client with WebSocket (for browsers only)


> Objective

A demo for DDP Client using only pure JS

## Features
- Following [DDP Specification](https://github.com/meteor/meteor/blob/devel/packages/ddp/DDP.md).
- Using [WebSocket APIs](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) for communicating with a server (DDP Server).
- Implementing with pure JS, no extra libraries needed.

## DDP server preparation
For this demo, I use [Rocket.Chat](https://github.com/RocketChat/Rocket.Chat) which contains a DDP Server. I shall create a user adming `wdc/secret` and some other users.


## Run
```bash
npm install
DEBUG=ws-ddp-client:* PORT=8080 npm start
```

## Usage
Simply import file `wdc.js` into your page

```html
<script src="public/javascripts/wdc.js"></script>
```


This project was bootstrapped with [express-generator](https://github.com/expressjs/express)


> TODOs
- Use Webpack to bundle "EJSON" instead of copying manually