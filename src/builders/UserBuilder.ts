import { faker } from '@faker-js/faker';
import type { Role } from '../schemas/user.schema.js';

export interface CreateUserPayload {
  email: string;
  name: string;
  password: string;
  role?: Role;
}

export class UserBuilder {
  private payload: CreateUserPayload = {
    email: faker.internet.email({ provider: 'example.test' }).toLowerCase(),
    name: faker.person.fullName(),
    password: faker.internet.password({ length: 12 }),
    role: 'user',
  };

  asAdmin(): this {
    this.payload.role = 'admin';
    return this;
  }

  asGuest(): this {
    this.payload.role = 'guest';
    return this;
  }

  withRole(role: Role): this {
    this.payload.role = role;
    return this;
  }

  withEmail(email: string): this {
    this.payload.email = email.toLowerCase();
    return this;
  }

  withRandomEmail(): this {
    this.payload.email = faker.internet.email({ provider: 'example.test' }).toLowerCase();
    return this;
  }

  withName(name: string): this {
    this.payload.name = name;
    return this;
  }

  withPassword(password: string): this {
    this.payload.password = password;
    return this;
  }

  withWeakPassword(): this {
    this.payload.password = '123';
    return this;
  }

  build(): CreateUserPayload {
    return { ...this.payload };
  }

  static random(): CreateUserPayload {
    return new UserBuilder().build();
  }
}
