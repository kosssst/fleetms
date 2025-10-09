FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm config delete proxy \
 && npm config delete https-proxy \
 && npm config set registry https://registry.npmjs.org/ \
 && npm config set strict-ssl true

RUN npm install

COPY . .

RUN npm run build

CMD ["npm", "start"]
