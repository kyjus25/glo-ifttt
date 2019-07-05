var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
const path = require('path');
const url = require('url');
var request = require('request');

var expressApp = express();
expressApp.use(cors());
expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: false }));

let queue = [];

expressApp.post('/glo/webhook', function (req, res) {
    if (req.body.hasOwnProperty('comment')) {
        const queueItem = {
            created_at: Date.now(),
            card_title: req.body.comment.text,
            meta: {
                id: Date.now(),
                timestamp: Date.now()
            }
        };
        queue.push(queueItem);
        notifyIFTTT();
    }
    console.log(req);
    res.send({});
});

expressApp.get('/ifttt/v1/user/info', function (req, res) {
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (token) {
        request.get('https://gloapi.gitkraken.com/v1/glo/user?access_token=' + token + '&fields=created_date,email,name,username',
            (error, response, body) => {
                if (error) {
                    console.error(error);
                    return
                }
                res.send({data: JSON.parse(body)});
            });
    } else {
        res.sendStatus(401);
    }

});

expressApp.post('/ifttt/v1/triggers/comment', function (req, res) {
    console.log(req.body);
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (token) {
        // request.get('https://gloapi.gitkraken.com/v1/glo/user?access_token=' + token + '&fields=created_date,email,name,username',
        //     (error, response, body) => {
        //         if (error) {
        //             console.error(error);
        //             return
        //         }
        //         res.send({data: JSON.parse(body)});
        //     });
        console.log('queue is ', queue);
        const response = {
            data: queue
        };
        queue = [];
        res.send(response);
    } else {
        res.sendStatus(401);
    }

});

expressApp.get('/ifttt/v1/status', function (req, res) {
    if (hasValidChannelKey(req)) {
        res.send({data: {message: 'ONLINE'}});
    } else {
        res.sendStatus(401);
    }
});

function notifyIFTTT() {
    const trigger_identity = 'cd664e533a437d232f2f57259b89c5ee30748f89';
    const payload = {
        data: [
            {
                'trigger_identity': trigger_identity
            }
        ]
    };
    const options = {
        uri: 'https://realtime.ifttt.com/v1/notifications',
        method: 'POST',
        json: true,
        headers: {
            'IFTTT-Service-Key': 'I0-JJPG3u54O-u9pM7TtnXwbH3uJ6t5JWUufVYoc2E6zd7Pz7KKpuIyih-DqQioZ',
            'X-Request-ID': '1'
        },
        body: payload
    };

    request(options, (error, response, body) => {});
}

function hasValidChannelKey(req) {
    return req.headers['ifttt-service-key'] === 'I0-JJPG3u54O-u9pM7TtnXwbH3uJ6t5JWUufVYoc2E6zd7Pz7KKpuIyih-DqQioZ';
}

var port = process.env.PORT || 4200;
expressApp.listen(port, () => console.log('Glo IFTTT listening'));

expressApp.use( express.static(__dirname + '/dist' ) );
