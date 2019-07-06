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
    // console.log('webhook');
    const queueItem = {
        event: req.body.action,
        board_id: req.body.hasOwnProperty('board') ? req.body.board.id : '',
        board_name: req.body.hasOwnProperty('board') ? req.body.board.name : '',
        column_title: req.body.hasOwnProperty('column') ? req.body.column.name : '',
        card_title: req.body.hasOwnProperty('card') ? req.body.card.name : '',
        comment_text: req.body.hasOwnProperty('comment') ? req.body.comment.text : '',
        person: req.body.sender.name,
        timestamp: Date.now(),
        meta: {
            id: Date.now(),
            timestamp: Date.now()
        }
    };
    queue.push(queueItem);
    notifyIFTTT();

    // console.log(req);
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

expressApp.post('/ifttt/v1/triggers/webhook', function (req, res) {
    const dto = req.body.triggerFields.dto;
    const event = req.body.triggerFields.event;
    const boardId = req.body.triggerFields.board;
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (token) {
        queue = queue.filter(item => item.board_id === boardId);
        queue = queue.filter(item => item.event.toLowerCase().includes(event.toLowerCase()));
        if (dto !== 'any') {
            switch(dto) {
                case 'card':
                    queue = queue.filter(item => item.card_title !== '');
                    break;
                case 'column':
                    queue = queue.filter(item => item.column_title !== '');
                    break;
                case 'comment':
                    queue = queue.filter(item => item.comment_text !== '');
                    break;
            }
        }
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

expressApp.post('/ifttt/v1/triggers/webhook/fields/board/options', function (req, res) {
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (token) {
        request.get('https://gloapi.gitkraken.com/v1/glo/boards?access_token=' + token,
            (error, req_response, body) => {
                if (error) {
                    console.error(error);
                    return
                }
                const boards = [];
                const jsonBody = JSON.parse(body);
                for (let i = 0; i < jsonBody.length; i++) {
                    boards.push({label: jsonBody[i].name, value: jsonBody[i].id});
                }
                const response = {
                    data: boards
                };
                res.send(response);
            });
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
    const trigger_identity = '0bd87892fb21654e1c4278f14a1707db7e7836d6';
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
