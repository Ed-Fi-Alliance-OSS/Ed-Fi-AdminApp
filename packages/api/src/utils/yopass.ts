import { PostApplicationResponseDtoBase } from '@edanalytics/models';
import axios, { AxiosResponse } from 'axios';
import config from 'config';
import { webcrypto } from 'crypto';
import { createMessage, encrypt } from 'openpgp';

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
  const password = randomString();
  const yopassBody = {
    expiration: 7 * 24 * 60 * 60,
    message: await encryptMessage(JSON.stringify(body), password),
    one_time: true,
  };

  const yopassResponse = (await axios.post(
    [backendDomain, 'secret'].join('/'),
    yopassBody
  )) as AxiosResponse<{ message: string }>;

  return {
    uuid: yopassResponse.data.message,
    password,
  };
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
