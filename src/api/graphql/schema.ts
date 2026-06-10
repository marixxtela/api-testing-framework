export const schema = /* GraphQL */ `
  type Query {
    user(id: ID!): User
    users(page: Int = 1, perPage: Int = 20, role: Role): UserPage!
    order(id: ID!): Order
    orders(page: Int = 1, perPage: Int = 20, status: OrderStatus): OrderPage!
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
  }

  enum Role {
    admin
    user
    guest
  }

  enum OrderStatus {
    pending
    paid
    shipped
    cancelled
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: Role!
    createdAt: String!
    orders: [Order!]!
  }

  type UserPage {
    data: [User!]!
    pagination: Pagination!
  }

  type Order {
    id: ID!
    userId: ID!
    status: OrderStatus!
    totalCents: Int!
    currency: String!
    createdAt: String!
    items: [OrderItem!]!
    user: User
  }

  type OrderItem {
    id: ID!
    sku: String!
    description: String!
    quantity: Int!
    priceCents: Int!
  }

  type OrderPage {
    data: [Order!]!
    pagination: Pagination!
  }

  type Pagination {
    page: Int!
    perPage: Int!
    total: Int!
  }

  input CreateUserInput {
    email: String!
    name: String!
    password: String!
    role: Role
  }
`;
