require('dotenv').config();
const mongoose = require('mongoose');
const cors = require('cors');

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Đã kết nối MongoDB thành công!'))
.catch((err) => console.error('❌ Lỗi kết nối MongoDB:', err));

var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var hosoRouter = require('./routes/hoso');
var authRouter = require('./routes/auth');
var adminRouter = require('./routes/admin');
var financialRouter = require('./routes/financial');
var aiRouter = require('./routes/ai');

var app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/hoso', hosoRouter);
app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/financial', financialRouter);
app.use('/ai', aiRouter);

module.exports = app;
