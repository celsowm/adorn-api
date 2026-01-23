import { describe, it, expect } from "vitest";
import {
  Exclude,
  Expose,
  Transform,
  serialize,
  createSerializer,
  Transforms
} from "../../src/core/serialization";

describe("Exclude decorator", () => {
  it("excludes field from serialization", () => {
    class User {
      name = "John";

      @Exclude()
      password = "secret";
    }

    const user = new User();
    const result = serialize(user);

    expect(result.name).toBe("John");
    expect(result.password).toBeUndefined();
  });

  it("excludes field only for specific groups", () => {
    class User {
      name = "John";

      @Exclude({ groups: ["public"] })
      email = "john@example.com";
    }

    const user = new User();

    const publicResult = serialize(user, { groups: ["public"] });
    expect(publicResult.email).toBeUndefined();

    const adminResult = serialize(user, { groups: ["admin"] });
    expect(adminResult.email).toBe("john@example.com");
  });
});

describe("Expose decorator", () => {
  it("exposes field with custom name", () => {
    class User {
      @Expose({ name: "fullName" })
      name = "John Doe";
    }

    const user = new User();
    const result = serialize(user);

    expect(result.fullName).toBe("John Doe");
    expect(result.name).toBeUndefined();
  });

  it("works with excludeAll option", () => {
    class User {
      @Expose()
      name = "John";

      secret = "hidden";
    }

    const user = new User();
    const result = serialize(user, { excludeAll: true });

    expect(result.name).toBe("John");
    expect(result.secret).toBeUndefined();
  });

  it("exposes field only for specific groups with excludeAll", () => {
    class User {
      @Expose({ groups: ["admin"] })
      id = "123";

      @Expose()
      name = "John";
    }

    const user = new User();

    const publicResult = serialize(user, { excludeAll: true, groups: ["public"] });
    expect(publicResult.id).toBeUndefined();
    expect(publicResult.name).toBe("John");

    const adminResult = serialize(user, { excludeAll: true, groups: ["admin"] });
    expect(adminResult.id).toBe("123");
    expect(adminResult.name).toBe("John");
  });
});

describe("Transform decorator", () => {
  it("transforms field value", () => {
    class User {
      @Transform((value: string) => value.toUpperCase())
      name = "john";
    }

    const user = new User();
    const result = serialize(user);

    expect(result.name).toBe("JOHN");
  });

  it("transforms only for specific groups", () => {
    class User {
      @Transform((_value: string) => "***", { groups: ["public"] })
      email = "john@example.com";
    }

    const user = new User();

    const publicResult = serialize(user, { groups: ["public"] });
    expect(publicResult.email).toBe("***");

    const adminResult = serialize(user, { groups: ["admin"] });
    expect(adminResult.email).toBe("john@example.com");
  });

  it("applies multiple transforms in order", () => {
    class User {
      @Transform((value: string) => value.trim())
      @Transform((value: string) => value.toUpperCase())
      name = "  john  ";
    }

    const user = new User();
    const result = serialize(user);

    expect(result.name).toBe("JOHN");
  });

  it("receives object as second argument", () => {
    class User {
      firstName = "John";
      lastName = "Doe";

      @Transform((_value: unknown, obj: unknown) => {
        const user = obj as User;
        return `${user.firstName} ${user.lastName}`;
      })
      fullName = "";
    }

    const user = new User();
    const result = serialize(user);

    expect(result.fullName).toBe("John Doe");
  });
});

describe("serialize function", () => {
  it("handles null and undefined", () => {
    expect(serialize(null as unknown as object)).toBeNull();
    expect(serialize(undefined as unknown as object)).toBeUndefined();
  });

  it("handles arrays", () => {
    class User {
      @Exclude()
      password = "secret";

      name = "John";
    }

    const users = [new User(), new User()];
    const result = serialize(users as unknown as object);

    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown as Array<{ name: string; password?: string }>)[0].name).toBe("John");
    expect((result as unknown as Array<{ name: string; password?: string }>)[0].password).toBeUndefined();
  });

  it("handles nested objects", () => {
    class Address {
      @Exclude()
      internal = "hidden";

      city = "NYC";
    }

    class User {
      name = "John";
      address = new Address();
    }

    const user = new User();
    const result = serialize(user);

    expect(result.name).toBe("John");
    expect((result.address as { city: string; internal?: string }).city).toBe("NYC");
    expect((result.address as { city: string; internal?: string }).internal).toBeUndefined();
  });

  it("handles arrays in objects", () => {
    class Tag {
      @Exclude()
      id = 1;

      name = "typescript";
    }

    class Post {
      title = "Hello";
      tags = [new Tag(), new Tag()];
    }

    const post = new Post();
    const result = serialize(post);

    expect(result.title).toBe("Hello");
    const tags = result.tags as Array<{ name: string; id?: number }>;
    expect(tags[0].name).toBe("typescript");
    expect(tags[0].id).toBeUndefined();
  });

  it("handles plain objects without decorators", () => {
    const obj = { name: "John", age: 30 };
    const result = serialize(obj);

    expect(result.name).toBe("John");
    expect(result.age).toBe(30);
  });
});

describe("createSerializer", () => {
  it("creates serializer with default options", () => {
    class User {
      @Expose()
      name = "John";

      secret = "hidden";
    }

    const publicSerializer = createSerializer({ excludeAll: true });
    const user = new User();
    const result = publicSerializer(user);

    expect(result.name).toBe("John");
    expect(result.secret).toBeUndefined();
  });

  it("allows overriding default options", () => {
    class User {
      @Expose({ groups: ["admin"] })
      id = "123";

      @Expose()
      name = "John";
    }

    const serializer = createSerializer({ excludeAll: true });
    const user = new User();

    const result = serializer(user, { groups: ["admin"] });
    expect(result.id).toBe("123");
  });
});

describe("Transforms helpers", () => {
  it("toISOString converts Date to ISO string", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    expect(Transforms.toISOString(date)).toBe("2024-01-15T10:30:00.000Z");
    expect(Transforms.toISOString("not a date")).toBe("not a date");
  });

  it("toLowerCase converts string to lowercase", () => {
    expect(Transforms.toLowerCase("HELLO")).toBe("hello");
    expect(Transforms.toLowerCase(123)).toBe(123);
  });

  it("toUpperCase converts string to uppercase", () => {
    expect(Transforms.toUpperCase("hello")).toBe("HELLO");
    expect(Transforms.toUpperCase(123)).toBe(123);
  });

  it("round rounds number to decimal places", () => {
    expect(Transforms.round(2)(3.14159)).toBe(3.14);
    expect(Transforms.round(0)(3.7)).toBe(4);
    expect(Transforms.round(2)("not a number")).toBe("not a number");
  });

  it("mask masks string value", () => {
    expect(Transforms.mask(4)("1234567890")).toBe("******7890");
    expect(Transforms.mask(4, "#")("secret")).toBe("##cret");
    expect(Transforms.mask(4)("abc")).toBe("abc");
    expect(Transforms.mask(4)(12345)).toBe(12345);
  });

  it("trim removes whitespace", () => {
    expect(Transforms.trim("  hello  ")).toBe("hello");
    expect(Transforms.trim(123)).toBe(123);
  });
});

describe("combined decorators", () => {
  it("works with Exclude and Transform together", () => {
    class User {
      @Exclude({ groups: ["public"] })
      @Transform((value: string) => value.toUpperCase())
      email = "john@example.com";
    }

    const user = new User();

    const publicResult = serialize(user, { groups: ["public"] });
    expect(publicResult.email).toBeUndefined();

    const adminResult = serialize(user, { groups: ["admin"] });
    expect(adminResult.email).toBe("JOHN@EXAMPLE.COM");
  });

  it("works with Expose and Transform together", () => {
    class User {
      @Expose({ name: "displayName" })
      @Transform((value: string) => value.toUpperCase())
      name = "john";
    }

    const user = new User();
    const result = serialize(user);

    expect(result.displayName).toBe("JOHN");
    expect(result.name).toBeUndefined();
  });
});
