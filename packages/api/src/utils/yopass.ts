import { PostApplicationResponseDtoBase } from '@edanalytics/models';
import axios, { AxiosResponse } from 'axios';
import config from 'config';
import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { webcrypto } from 'crypto';
import { createMessage, encrypt } from 'openpgp';

const logger = new Logger('Yopass');

const YOPASS_ERROR_MESSAGE = 'Failed to create secure link for credentials. Please contact your administrator for assistance.';

const randomString = (): string => {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 22; i++) {
    text += possible.charAt(randomInt(0, possible.length));
  }
  return text;
};

const randomInt = (min: number, max: number): number => {
  const byteArray = new Uint8Array(1);
  webcrypto.getRandomValues(byteArray);

  const range = max - min;
  const maxRange = 256;
  if (byteArray[0] >= Math.floor(maxRange / range) * range) {
    return randomInt(min, max);
  }
  return min + (byteArray[0] % range);
};

const backendDomain = config.YOPASS_URL;

const getYopassResponse = async (body: object): Promise<{ uuid: string; password: string }> => {
  // Check if Yopass is configured
  if (!backendDomain) {
    throw new HttpException(
      {
        message: YOPASS_ERROR_MESSAGE,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }

  const password = randomString();
  const yopassBody = {
    expiration: 7 * 24 * 60 * 60,
    message: await encryptMessage(JSON.stringify(body), password),
    one_time: true,
  };

  try {
    const yopassResponse = (await axios.post(
      [backendDomain, 'secret'].join('/'),
      yopassBody
    )) as AxiosResponse<{ message: string }>;

    return {
      uuid: yopassResponse.data.message,
      password,
    };
  } catch (error) {
    logger.error('Yopass service error:', {
      url: backendDomain,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new HttpException(
      {
        message: YOPASS_ERROR_MESSAGE,
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
};

export const postYopassSecret = async (body: PostApplicationResponseDtoBase & { url: string }) => {
  const { uuid, password } = await getYopassResponse(body);

  return {
    link: [config.FE_URL, 'secret/#', uuid, password].join('/'),
  };
};

const encryptMessage = async (data: string, passwords: string) => {
  return encrypt({
    message: await createMessage({ text: data }),
    passwords,
  });
};
