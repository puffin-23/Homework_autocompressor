const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream');
const util = require('util');

const pipelineAsync = util.promisify(pipeline);

async function compressFile(filePath) {
   //Проверяем наличие расширения .gz
   if (path.extname(filePath) !== '.gz') {

      let compressedFile = await findFile(process.argv[2], filePath + '.gz');

      if (compressedFile) {
         console.log(`Файл ${filePath} уже сжат.`);

         let compressedFilePath = compressedFile;
         let sourceFilePath = filePath
         let compressedFileStat = await fsPromises.stat(compressedFilePath);
         let sourceFileStat = await fsPromises.stat(sourceFilePath);

         // Проверяем, нужно ли удалять старый архив
         if (compressedFileStat.mtime < sourceFileStat.mtime) {
            // Удаляем старый архив
            try {
               await fsPromises.unlink(compressedFilePath);
               console.log(`Старый архив ${compressedFilePath} удален.`);
            } catch (error) {
               console.error(`Ошибка при удалении старого архива ${compressedFilePath}:`, error);
            }
            //Создаем новый архив
            let compressedFilePath = sourceFilePath + '.gz';

            const sourceStream = fs.createReadStream(filePath);
            const destinationStream = fs.createWriteStream(compressedFilePath)
            const gzipStream = zlib.createGzip();

            await pipelineAsync(sourceStream, gzipStream, destinationStream);
            console.log(`Файл ${filePath} успешно сжат в ${compressedFilePath}`);

         } else if (compressedFileStat.mtime >= sourceFileStat.mtime) {
            // Если архивный файл более новый или актуален, то мы его не удаляем
            console.log(`Архивный файл ${compressedFilePath} актуален.`);
         }
      } else if (!compressedFile) {
         //Создаем новый архив
         let compressedFilePath = filePath + '.gz';

         const sourceStream = fs.createReadStream(filePath);
         const destinationStream = fs.createWriteStream(compressedFilePath)
         const gzipStream = zlib.createGzip();

         await pipelineAsync(sourceStream, gzipStream, destinationStream);
         console.log(`Файл ${filePath} успешно сжат в ${compressedFilePath}`);
      }

   } else if (path.extname(filePath) == '.gz') {
      console.log(`Файл ${filePath} имеет расширение .gz. Сжатие не требуется.`);
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

async function findFile(dir, fileName) {
   try {
      let files = await fs.promises.readdir(dir); // Читаем содержимое директории
      let found = false; // Переменная для отслеживания, найден ли файл

      for (const file of files) {
         const filePath = path.join(dir, file); // Формируем полный путь к файлу
         const stat = await fs.promises.stat(filePath); // Получаем информацию о файле

         if (stat.isDirectory()) {
            // Если это директория, делаем рекурсивный вызов
            const result = await findFile(filePath, fileName);
            if (result) {
               return result; // Если файл найден в поддиректории, возвращаем его путь
            }
         } else if (file === fileName) {
            // Если нашли искомый файл
            return filePath; // Возвращаем полный путь к найденному файлу
         }
      }

      // Если файл не найден в данной директории, но мы прошли все файлы
      if (!found) {
         console.log(`Файл ${fileName} не найден в директории ${dir}.`);
      }
      
   } catch (error) {
      console.error(`Ошибка при поиске файла ${fileName} в директории ${dir}:`, error);
   }

   return null; // Возвращаем null, если файл не найден
}