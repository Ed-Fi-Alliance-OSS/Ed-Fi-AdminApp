import * as openpgp from 'openpgp/lightweight';
import urlJoin from 'url-join';
import { environment } from '../../environments/environment.local';

const decryptMessage = async (
  data: string,
  pwd: string
): Promise<openpgp.DecryptMessageResult> => {
  return openpgp.decrypt({
    message: await openpgp.readMessage({ armoredMessage: data }),
    passwords: pwd,
    format: 'utf8',
  });
};

export const getMessage = async (uuid: string, pwd: string) => {
  const data = await fetch(urlJoin(environment.YOPASS_URL, 'secret', uuid))
    .then((res) => {
      if (res.status === 404) {
        throw 404;
      } else {
        return res.text();
      }
    })
    .then((res) => JSON.parse(res));

  return await decryptMessage(data.message, pwd);
};
