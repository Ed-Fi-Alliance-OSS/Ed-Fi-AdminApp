import { Transform } from 'class-transformer';

export default function TrimWhitespace() {
  return Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));
}
