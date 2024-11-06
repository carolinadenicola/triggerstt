const { app } = require('@azure/functions');
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const { Buffer } = require('buffer');
const os = require('os');

app.http('httpTriggerSTT', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log("Http function processing audio request...");

        try {
            // Receber o vídeo em base64 do corpo da requisição
            const requestBody = await request.json();
            const videoBase64 = requestBody.audio_base64;
            if (!videoBase64) {
                return { status: 400, body: "Base64 de vídeo não encontrado na solicitação" };
            }

            // Definir o caminho temporário para os arquivos
            const tempDir = os.tmpdir(); // Usa o diretório temporário apropriado
            const tempInputPath = path.join(tempDir, 'temp_video_input.webm');
            const tempOutputPath = path.join(tempDir, 'temp_audio_output.wav');

            // Decodificar o vídeo base64 e salvar em um arquivo temporário
            context.log("Decodificando e salvando o vídeo em um arquivo temporário...");
            const videoBuffer = Buffer.from(videoBase64.split(',')[1], 'base64');
            await fs.writeFile(tempInputPath, videoBuffer);

            // Extrair o áudio e converter para WAV
            context.log("Extraindo áudio do vídeo e convertendo usando ffmpeg...");
            await new Promise((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .setFfmpegPath(ffmpegPath)
                    .audioFrequency(16000)
                    .audioChannels(1)
                    .audioBitrate('16k')
                    .format('wav')
                    .noVideo()
                    .on('end', () => {
                        context.log("Conversão concluída com sucesso.");
                        resolve();
                    })
                    .on('error', (err) => {
                        context.log("Erro durante a conversão:", err);
                        reject(err);
                    })
                    .save(tempOutputPath);
            });

            // Ler o arquivo de saída e converter para base64
            context.log("Lendo o arquivo convertido e codificando para base64...");
            const outputBuffer = await fs.readFile(tempOutputPath);
            const convertedAudioBase64 = `data:audio/wav;base64,${outputBuffer.toString('base64')}`;

            // Limpar arquivos temporários
            await fs.remove(tempInputPath);
            await fs.remove(tempOutputPath);
            context.log("Arquivos temporários removidos.");

            // Retornar o áudio convertido em base64
            return {
                status: 200,
                headers: { "Content-Type": "text/plain" },
                body: convertedAudioBase64
            };

        } catch (error) {
            context.log("Erro ao processar o vídeo:", error);
            return {
                status: 500,
                body: "Erro ao processar o vídeo."
            };
        }
    }
});