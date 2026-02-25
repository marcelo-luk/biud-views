export interface HydratedPersonInterface {
  cpf: string;
  data: string;
}

export interface HydratedPersonWithCustomerInterface  extends HydratedPersonInterface {
  customerId: number;
}
