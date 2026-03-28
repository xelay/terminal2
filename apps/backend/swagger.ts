import swaggerAutogen from 'swagger-autogen';

const doc = {
  info: {
    title: 'Terminal API',
    description: 'API Documentation for my backend'
  },
  host: 'localhost:3000'
};

const outputFile = './swagger_output.json';
// Укажите главный файл, где подключаются все роуты (app.use...)
const routes = ['./src/server.ts']; 

swaggerAutogen()(outputFile, routes, doc);
