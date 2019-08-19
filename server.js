const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); //we need this so the front-end can                                      fetch from the localhost
const knex = require('knex');
const bcrypt = require('bcrypt');

// const postgres = knex({
//     client: 'pg',
//     connection: {
//       connectionString : process.env.DATABASE_URL,
//       ssl: true
//     }
//   });

const postgres = knex({
    client: 'pg',
    connection: {
      host : '127.0.0.1',
      user : 'postgres',
      password : '',
      database : 'loginpractice'
    }  
})

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.get('/', (req,res) => { res.send('It is working')})

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



app.get('/todolist', (req,res) => {
    const { email} = req.body;

    postgres.select('title', 'id', 'completed').from('todolist') 
        .where('email', '=', email)
        .then(todo => {
            res.json(todo)
        })
        .catch(err=> res.status(400).json('unable to get todo list'))
    
})

app.post('/addtodo', (req,res) => {
    const{ email, title} = req.body;

    postgres.insert({
        'email': email,
        'title': title
    }).into('todolist').returning('title')
    .then(title => res.json(title))
    .catch(err=> res.status(400).json('unable to add todo'))

})

app.put('/completed', (req,res) => {
    const { id } = req.body;

    postgres.transaction( trx => {
        trx.select('completed').from('todolist').where('id', '=', id)
        .then( currentState => {
            return trx('todolist').where('id', '=', id)
            .update({
                completed: !currentState[0].completed
            }).returning('*')
            .then(data => res.json(data))
            .catch( err => res.status(400).json('error toggling complete'))
        }).then(trx.commit)
        .catch( err => res.status(400).json('unable to select todo'))
    })
    

})

app.delete('/deltodo', (req,res) => {
    const { id } = req.body;

    postgres('todolist').where('id', '=', id).del()
        .then( response => res.json('item deleted'))
        .catch(err => res.json('unable to delete todo'))
})

app.listen(process.env.PORT || 3005, () => {
    console.log(`app is running on PORT ${process.env.port || 3005}`);
})