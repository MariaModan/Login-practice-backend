const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); //we need this so the front-end can                                      fetch from the localhost
const knex = require('knex');
const bcrypt = require('bcrypt');

const postgres = knex({
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      user : 'postgres',
      password : 'aA123adata',
      database : 'loginpractice'
    }
  });

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.post('/signin', (req,res) => {
    const { email, password } = req.body;
    
    postgres.select('email', 'hash').from('login')
        .where('email', '=', email)
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hash)
            if (isValid) {
                return postgres.select('*')
                                .from('users')
                                .where('email', '=', email)
                                .then( user => {
                                    res.json(user[0])
                                })
                                .catch(err => res.status(400).json('unable to log in'))
            } else {
                res.status(400).json('credentials do not match')
            }
        })
        .catch(err => res.status(400).json('unable to log in'))
        
})

app.post('/register', (req,res) => {
    const { name, email, password } = req.body;
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    postgres.transaction( trx => {
        trx.insert({
                email: email,
                hash: hash
            })
            .into('login')
            .returning('email')
            .then( loginEmail => {
                return trx('users')
                        .insert({
                            name: name,
                            email: loginEmail[0],//loginEmail gets returned as an array so we need to use [0]
                            joined: new Date()
                        })
                        .returning('*')
            })
            .then( user => {
                //the promise return an array with just one element so we need to grab user[0] to access the user who just registered
                res.json(user[0])
            })
            .then(trx.commit)
            .catch(err => res.status(400).json('1unable to register'))
        .catch(err => res.status(400).json('2unable to register'))
            
    })
})

app.listen(3005, () => {
    console.log('app is running');
})