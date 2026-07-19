import { jsDocstringChecker } from "./factories/js-docstring-checker.ts";
import { pythonDocstringChecker } from "./factories/python-docstring-checker.ts";
import { loadConfig, isIgnored, detectLanguage } from "./factories/index.ts";

// Test JS/TS checker
const jsCode = `
function foo(a: string) {
  return a;
}

/** Already documented. */
function bar(b: number) {
  return b;
}

const baz = (x: string) => x;

class MyClass {
  method1() {}

  /** Documented method. */
  method2() {}
}
`;

const jsResult = jsDocstringChecker.check(jsCode);
console.log("JS missing:", jsResult.missing.map((m) => `${m.name} (line ${m.line})`));

// Test Python checker
const pyCode = `
def undocumented(a, b):
    return a + b

def documented(a, b):
    """This is documented."""
    return a + b

class MyClass:
    pass

class DocumentedClass:
    """This class is documented."""
    pass
`;

const pyResult = pythonDocstringChecker("google").check(pyCode);
console.log("Python missing:", pyResult.missing.map((m) => `${m.name} (line ${m.line})`));

// Test config/ignore
const config = loadConfig("/tmp/docstring_enforcer_config.json");
console.log("Config loaded. Supported:", Object.keys(config.supportedLanguages));
console.log("Is .md ignored?", isIgnored("README.md", config));
console.log("Is node_modules ignored?", isIgnored("/project/node_modules/foo.ts", config));
console.log("Detect .ts:", detectLanguage("/project/src/foo.ts", config));
console.log("Detect .py:", detectLanguage("/project/src/foo.py", config));
