const {argv} = process;

// make it executable

class FieldBuilder {
    static FIELD_SPLITTER = "-->";

    /*** @param {Object<string, Type | Function>} fields */
    constructor(fields = {}) {
        this.fields = fields;
    }

    /**
     * @param {string} name
     * @return {Type | Function}
     */
    getFieldNested(name) {
        name = name.split(".").map(i => `["${FieldBuilder.FIELD_SPLITTER}${i.replaceAll("\"", "\\\"").replaceAll("\\", "\\\\")}"]`).join("");
        const fields = this.fields;
        return eval("fields" + name);
    }

    /**
     * @param {string} name
     * @return {Type | Function}
     */
    getField(name) {
        return this.fields[FieldBuilder.FIELD_SPLITTER + name];
    }

    /**
     * @param {string} name
     * @param {Type | Function} value
     */
    setFieldNested(name, value) {
        name = name.split(".").map(i => `["${FieldBuilder.FIELD_SPLITTER}${i.replaceAll("\"", "\\\"").replaceAll("\\", "\\\\")}"]`).join("");
        const fields = this.fields;
        eval("fields" + name + " = value");
    }

    /**
     * @param {string} name
     * @param {Type | Function} value
     */
    setField(name, value) {
        this.fields[FieldBuilder.FIELD_SPLITTER + name] = value;
    }
}


class Type extends FieldBuilder {
}

class ClassType extends Type {
    /**
     * @param {string} name
     * @param {(ClassType | Object<string, Type | Function<Promise>>)?} prototype
     * @param {FunctionInstanceType | Function<Promise>} constructor
     */
    constructor(name, prototype = {
        toString: () => new StringType(name)
    }, constructor) {
        super();
        this.name = name;
        this.setField("new", this.new);
        this.setField("prototype", prototype);
        this.setField("constructor", constructor);
    }

    new(args) {
        return new ClassInstanceType(this, args);
    }
}

class ClassInstanceType extends Type {
    /**
     * @param {ClassType} classType
     * @param {(Type | Function<Promise>)[]} args
     */
    constructor(classType, args) {
        super(classType);
        this.classType = classType;
        classType.getField("constructor").call(this, args);
    }
}

class FunctionClass extends ClassType {
    /*** @param {Line[] | Function<Promise>} callable */
    constructor(callable) {
        super("Function", {});
        this.setFieldNested("prototype.call", (callable instanceof Function ? callable : async () => {
            for (let i = 0; i < callable.length; i++) {
                const returned = await callable[i].run();
                if (!(returned instanceof NullType)) return returned;
            }
            return new NullType();
        }));
    }

    /**
     * @param {ClassInstanceType[]} args
     * @return {CallableType}
     */
    createCallable(args) {
        return new CallableType(this, args);
    }

    /**
     * @param {ClassInstanceType[]} args
     * @return {Promise<ClassInstanceType>}
     */
    async run(args) {
        return await this.createCallable(args).run();
    }
}

class FunctionInstanceType extends ClassInstanceType {
    /*** @param {FunctionClass} functionClass */
    constructor(functionClass) {
        super(functionClass);
    }
}

class CallableType extends Type {
    /**
     * @param {FunctionClass} functionType
     * @param {ClassInstanceType[]} args
     */
    constructor(functionType, args) {
        super();
        this.functionType = functionType;
        this.args = args;
    }

    /*** @return {Promise<ClassInstanceType>} */
    async run() {
        const called = this.functionType.fields.get("call");
        if (called instanceof ClassInstanceType) return called;
        return await called.call(...this.args);
    }
}

class StringType extends ClassType {
    /*** @param {string} value */
    constructor(value) {
        super("String", {});
        this.setField("value", value);
    }

    toString() {
        return this.fields.get("value");
    }
}

class NumberType extends ClassType {
    /*** @param {number} value */
    constructor(value) {
        super("Number");
        this.setField("value", value);
    }

    toString() {
        return this.fields.get("value");
    }
}

class BooleanType extends ClassType {
    /*** @param {boolean} value */
    constructor(value) {
        super("Boolean");
        this.setField("value", value);
    }

    toString() {
        return this.fields.get("value");
    }
}

class NullType extends ClassType {
    constructor() {
        super("Null");
    }

    toString() {
        return "null";
    }
}

class ErrorType extends ClassType {
    /*** @param {string} message */
    constructor(message) {
        super("Error");
        this.setField("message", message);
    }

    toString() {
        return this.fields.get("message");
    }
}

class PromiseType extends ClassType {
    /*** @param {Promise<Type>} promise */
    constructor(promise) {
        super("Promise");
        this.setField("promise", promise);
    }

    toString() {
        return this.fields.get("promise");
    }
}

/**
 * @param {ClassInstanceType | Function<Promise<ClassInstanceType>>} object
 * @return {ClassInstanceType}
 */
async function recursiveFetchObject(object) {
    if (object instanceof FunctionClass) return recursiveFetchObject(object.fields.get("call"));
    else if (object instanceof ClassInstanceType) return object;
    else if (object instanceof Function) return await object();
}

class Line {
    /*** @param {(ClassInstanceType | Line | Function<Promise<ClassInstanceType>>)[]} line */
    constructor(line) {
        this.line = line;
    }

    async run() {
        for (const item of this.line) {
            if (item instanceof Line) {
                const obj = await recursiveFetchObject(item);
                if (obj instanceof CallableType) {
                    await obj.run();
                }
            }
        }
        return new NullType();
    }
}

class IfLine extends Line {
    /**
     * @param {ClassInstanceType |  | Function<Promise<ClassInstanceType>>} condition
     * @param {(ClassInstanceType | Function<Promise<ClassInstanceType>>)[]} line
     */
    constructor(condition, line) {
        super(line);
        this.condition = condition;
    }

    async run() {
    }
}