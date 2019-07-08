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
let trigger_identities = [];

expressApp.post('/', function (req, res) {
    console.log('webhook');
    const queueItem = {
        event: req.body.action,
        board_id: req.body.hasOwnProperty('board') ? req.body.board.id : '',
        board_name: req.body.hasOwnProperty('board') ? req.body.board.name : '',
        column_title: req.body.hasOwnProperty('column') ? req.body.column.name : '',
        card_title: req.body.hasOwnProperty('card') ? req.body.card.name : '',
        comment_text: req.body.hasOwnProperty('comment') ? req.body.comment.text : '',
        person: req.body.sender.name,
        timestamp: new Date(Date.now()).toISOString(),
        meta: {
            id: new Date(Date.now()).toISOString(),
            timestamp: new Date(Date.now()).toISOString()
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
                if (error || JSON.parse(body).hasOwnProperty('message')) {
                    console.error(error);
                    res.status(401).send({errors: [{"message": "Something went wrong!"}]});
                    return
                }
                res.send({data: JSON.parse(body)});
            });
    } else {
        res.status(401).send({errors: [{"message": "Something went wrong!"}]});
    }

});

expressApp.post('/ifttt/v1/triggers/webhook', function (req, res) {
    if (req.body.hasOwnProperty('triggerFields')) {
        const dto = req.body.triggerFields.dto;
        const event = req.body.triggerFields.event;
        const boardId = req.body.triggerFields.board;
        const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
        if (token) {
            if (req.body.hasOwnProperty('trigger_identity')) {
                addTriggerIdentity(req.body.trigger_identity);
            }
            // console.log(req.headers);
            // console.log('boardId', boardId);
            // console.log(queue);
            queue = queue.filter(item => item.board_id === boardId);
            if (event !== 'all') {
                queue = queue.filter(item => item.event.toLowerCase().includes(event.toLowerCase()));
            }
            if (dto !== 'all') {
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
            res.status(401).send({errors: [{"message": "Something went wrong!"}]});
        }
    } else {
        res.status(400).send({errors: [{"message": "Bad request!"}]});
    }
});

expressApp.post('/ifttt/v1/triggers/webhook/fields/board/options', function (req, res) {
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (token) {
        request.get('https://gloapi.gitkraken.com/v1/glo/boards?access_token=' + token,
            (error, req_response, body) => {
                if (error || body.hasOwnProperty('message')) {
                    console.error(error);
                    res.status(401).send({errors: [{"message": "Something went wrong!"}]});
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
        res.status(401).send({errors: [{"message": "Something went wrong!"}]});
    }
});

expressApp.post('/ifttt/v1/actions/create_card', function (req, res) {
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (token) {
        // console.log(req.body);
        // console.log('##########');
        // console.log(req.headers);

        // console.log(req.body['actionFields']['board_and_column']);
        // console.log(req.body['actionFields']['card_title']);
        let boardId = '';
        let columnId = '';
        if (req.body['actionFields']['board_and_column']) {
            boardId = req.body['actionFields']['board_and_column'].split('/')[0];
            columnId = req.body['actionFields']['board_and_column'].split('/')[1];
        }


        console.log('BOARD ID', boardId);
        console.log('COLUMN ID', columnId);

        const card = {
            "name": req.body['actionFields']['card_title'],
            "column_id": columnId
        };

        const options = {
            uri: 'https://gloapi.gitkraken.com/v1/glo/boards/' + boardId + '/cards?access_token=' + token,
            method: 'POST',
            json: true,
            body: card
        };

        request(options, (error, req_response, body) => {
            console.log(body);
            if (error || body.hasOwnProperty('message')) {
                console.error(error);
                res.status(401).send({errors: [{"message": "Something went wrong!"}]});
                return
            }
            const response = {
                data: {response: 'success'}
            };
            res.send(response);
        });
    } else {
        res.status(401).send({errors: [{"message": "Something went wrong!"}]});
    }
});

expressApp.post('/ifttt/v1/actions/create_card/fields/board_and_column/options', function (req, res) {
    const token = req.headers['authorization'] ? req.headers['authorization'].split(' ')[1] : null;
    if (token) {
        request.get('https://gloapi.gitkraken.com/v1/glo/boards?fields=columns,name&access_token=' + token,
            (error, req_response, body) => {
                if (error || body.hasOwnProperty('message')) {
                    console.error(error);
                    res.status(401).send({errors: [{"message": "Something went wrong!"}]});
                    return
                }
                const boards_columns = [];
                const jsonBody = JSON.parse(body);
                for (let i = 0; i < jsonBody.length; i++) {
                    for (let j = 0; j < jsonBody[i].columns.length; j++) {
                        const label = jsonBody[i].name + ' / ' + jsonBody[i].columns[j].name;
                        const value = jsonBody[i].id + '/' + jsonBody[i].columns[j].id;
                        boards_columns.push({label: label, value: value});
                    }
                }
                const response = {
                    data: boards_columns
                };
                res.send(response);
            });
    } else {
        res.status(401).send({errors: [{"message": "Something went wrong!"}]});
    }
});

expressApp.get('/ifttt/v1/status', function (req, res) {
    if (hasValidChannelKey(req)) {
        res.send({data: {message: 'ONLINE'}});
    } else {
        res.status(401).send({errors: [{"message": "Something went wrong!"}]});
    }
});

expressApp.post('/ifttt/v1/test/setup', function (req, res) {
    if (hasValidChannelKey(req)) {
        const token = 'ad5f60ba0b12273004d90af2ddbab5dd4f26e8ca';
        const response = {
            accessToken: token,
            samples: {
                triggers: {
                    webhook: {
                        board: "5d215f089a48190010c2e25f",
                        dto: "all",
                        event: "all"
                    }
                },
                actions: {
                    create_card: {
                        board_and_column: "test",
                        card_title: "test"
                    }
                },
                actionRecordSkipping: {
                    create_card: {
                        board_and_column: "test",
                        card_title: "test"
                    }
                }
            }
        };
        res.send({data: response});
    } else {
        res.status(401).send({errors: [{"message": "Something went wrong!"}]});
    }
});

function notifyIFTTT() {
    // console.log('notifying');
    const triggerIdentityMap = [];
    for (let i = 0; i < trigger_identities.length; i++) {
        triggerIdentityMap.push({'trigger_identity': trigger_identities[i]});
    }
    const payload = {
        data: triggerIdentityMap
    };
    // console.log(payload);
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

function addTriggerIdentity(triggerIdentity) {
    if (!trigger_identities.includes(triggerIdentity)) {
        trigger_identities.push(triggerIdentity);
    }
}

var port = process.env.PORT || 80;
expressApp.listen(port, () => console.log('Glo IFTTT listening'));

expressApp.use( express.static(__dirname + '/dist' ) );
