const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');
const util = require('util');

const pipelineAsync = util.promisify(pipeline);

async function compressFile(filePath) {
   //Проверяем наличие расширения .gz
   if (path.extname(filePath) === '.gz') {

      console.log(`Файл ${filePath} является архивом.`);

      let compressedFilePath = filePath;
      let sourceFilePath = filePath.replace('.gz', '');
      let compressedFileStat = await fsPromises.stat(compressedFilePath);
      let sourceFileStat = await fsPromises.stat(sourceFilePath);

      // Проверяем, нужно ли удалять старый архив
      if (compressedFileStat.mtime < sourceFileStat.mtime) {
         console.log(`Архивный файл ${compressedFilePath} устарел.`);

         let newCompressedFilePath = sourceFilePath + '.gz';

         const sourceStream = fs.createReadStream(sourceFilePath);
         const destinationStream = fs.createWriteStream(newCompressedFilePath)
         let gzipStream = zlib.createGzip();
         await pipelineAsync(sourceStream, gzipStream, destinationStream);
         console.log(`Файл ${filePath} успешно обновлен в ${compressedFilePath}`);

      } else if (compressedFileStat.mtime >= sourceFileStat.mtime) {
         // Если архивный файл более новый или актуален, то мы его не удаляем
         console.log(`Архивный файл ${compressedFilePath} актуален.`);
      }

   } else if (path.extname(filePath) !== '.gz') {

      if (!fs.existsSync(filePath + '.gz')) {
         console.log(`Файл ${filePath} не сжат.`);
         let compressedFilePath = filePath + '.gz';

         const sourceStream = fs.createReadStream(filePath);
         const destinationStream = fs.createWriteStream(compressedFilePath)
         const gzipStream = zlib.createGzip();

         await pipelineAsync(sourceStream, gzipStream, destinationStream);
         console.log(`Файл ${filePath} успешно сжат в ${compressedFilePath}`);
      } else if (fs.existsSync(filePath + '.gz')) {
         console.log(`Файл ${filePath} уже сжат.`);
      }
   }

}

async function scanDirectory(directoryPath) {
   try {
      const files = await fsPromises.readdir(directoryPath, { withFileTypes: true });

      for (const file of files) {
         const fullPath = path.join(directoryPath, file.name);

         if (file.isDirectory()) {
            // Рекурсивно обрабатываем подпапки
            await scanDirectory(fullPath);
         } else if (file.isFile()) {
            // Обрабатываем файл
            await compressFile(fullPath);
         }
      }
   } catch (error) {
      console.error(`Ошибка при сканировании директории ${directoryPath}:`, error);
   }
}

// Запуск функции сканирования с указанной директории
async function main() {
   const directoryPath = process.argv[2];

   if (!directoryPath) {
      console.error('Пожалуйста, укажите путь к папке.');
      process.exit(1);
   }

   try {
      await scanDirectory(directoryPath);
      console.log('Сканирование завершено.');
   } catch (err) {
      console.error('Ошибка:', err);
   }
}

main();