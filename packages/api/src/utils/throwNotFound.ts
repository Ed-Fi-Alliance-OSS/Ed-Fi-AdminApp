import { NotFoundException } from "@nestjs/common"

export const throwNotFound = () => { throw new NotFoundException() }

export const throwNotFoundText = (text: string) => () => { throw new NotFoundException(text) }
