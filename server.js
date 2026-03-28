const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Shared lock — prevents concurrent update processes
let isAptRunning = false;

app.locals.isAptRunning = () => isAptRunning;
app.locals.setAptRunning = (v) => { isAptRunning = v; };

app.use('/status',          require('./routes/status'));
app.use('/autodarts',       require('./routes/autodarts'));
app.use('/system',          require('./routes/system').router);
app.use('/reboot',          require('./routes/power').rebootRouter);
app.use('/shutdown',        require('./routes/power').shutdownRouter);

const PORT = 8743;
if (require.main === module) {
  app.listen(PORT, () => console.log(`RasPi Manager running on port ${PORT}`));
}

module.exports = app;
