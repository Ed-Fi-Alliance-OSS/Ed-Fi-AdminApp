import { PostApplicationResponseDto } from '@edanalytics/models';
import axios, { AxiosResponse } from 'axios';
import { webcrypto } from 'crypto';
import dayjs from 'dayjs';
import { createMessage, encrypt } from 'openpgp';
import { environment } from '../environments/environment.local';

type Response = {
  message: string;
};

const randomString = (): string => {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
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

const backendDomain = environment.YOPASS_URL;

export const postYopassSecret = async (body: PostApplicationResponseDto) => {
  const pwd = randomString();
  const yopassBody = {
    expiration: 7 * 24 * 60 * 60,
    message: await encryptMessage(
      `KEY:
${body.key}

SECRET:
${body.secret}`,
      pwd
    ),
    one_time: true,
  };
  const yopassResponse = await axios.post<any, AxiosResponse<Response>>(
    [backendDomain, 'secret'].join('/'),
    yopassBody
  );

  const uuid = yopassResponse.data.message;

  return {
    link: [environment.FE_URL, 'secret', uuid, pwd].join('/'),
  };
};

const encryptMessage = async (data: string, passwords: string) => {
  return encrypt({
    message: await createMessage({ text: data }),
    passwords,
  });
};
