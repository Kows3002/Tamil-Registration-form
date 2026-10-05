require('dotenv').config()
const app = require('./app')
const connectDB = require('./config/db')
const port = process.env.PORT || 5000
connectDB().then(() => app.listen(port, () => console.log(`API listening on ${port}`))).catch(error => { console.error(`MongoDB connection failed: ${error.message}`); process.exit(1) })
