# universal-translator: the CLI and the HTTP translation API in one image.
# docker build -t universal-translator .
# docker run --rm -p 8080:8080 universal-translator            # serve the API
# docker run --rm -i universal-translator translate javascript python - < app.js
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY bin ./bin
COPY common-library ./common-library
COPY js/src ./js/src
COPY vendor/meta-language-grammar ./vendor/meta-language-grammar
COPY data ./data
USER node
EXPOSE 8080
ENTRYPOINT ["node", "bin/universal-translator.js"]
CMD ["serve", "--port", "8080"]
