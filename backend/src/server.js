require('dotenv').config()
const app = require('./app')
const connectDB = require('./config/db')
const port = process.env.PORT || 5000
async function start() {
  try {
    console.log(`Master-data routes registered: ${app.locals.masterDataGetRoutes.join(', ')}`)
    await connectDB()
    app.listen(port, () => console.log(`API listening on ${port}`))
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`)
    process.exitCode = 1
  }
}
start()
