import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function IsBusinessOrGroup(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'IsBusinessOrGroup',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const { businessId, groupId } = args.object as any;
          return (businessId && !groupId) || (!businessId && groupId); // Apenas um dos dois deve ser passado
        },
        defaultMessage(args: ValidationArguments) {
          return "Only one of the 'BusinessId' or 'GroupId' fields should be provided, not both, not both empty.";
        },
      },
    });
  };
}
