// Generated from data/02-managed.lino.
export default `profile:
  id: javascript
  unicodeGreeting: true
  label: JavaScript
  comment: //
  call: 'method call'
  output: console.log
  forms:
    form:
      task: empty-program
      name: standard
      requires: ()
      output: exit
      fixed:
        status: 0
      source: ()
    form:
      task: hello
      name: standard
      requires: console
      source:
        (line: 'console.log("{{message}}");')
    form:
      task: hello
      name: single-quotes
      requires: console
      source:
        (line: "console.log('{{message}}');")
    form:
      task: hello
      name: rosetta
      requires: console
      source:
        (line: 'console.log("{{message}}")')
    form:
      task: hello
      name: common
      requires: './common-library.mjs'
      output: printLine
      source:
        (line: "import { printLine } from './common-library.mjs';")
        (line: ~1{})
        (line: 'printLine("{{message}}");')
    form:
      task: write-text
      name: standard
      requires: process.stdout
      output: process.stdout.write
      source:
        (line: 'process.stdout.write("{{message}}");')
    form:
      task: write-text
      name: common
      requires: './common-library.mjs'
      output: writeText
      source:
        (line: "import { writeText } from './common-library.mjs';")
        (line: ~1{})
        (line: 'writeText("{{message}}");')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'let left = {{left}};')
        (line: 'let right = {{right}};')
        (line: 'while (right !== 0) {')
        (line: '    const remainder = left % right;')
        (line: '    left = right;')
        (line: '    right = remainder;')
        (line: })
        (line: 'console.log(left);')
    form:
      task: greatest-common-divisor
      name: common
      requires: './common-library.mjs'
      output: printLine
      source:
        (line: "import { greatestCommonDivisor, printLine } from './common-library.mjs';")
        (line: ~1{})
        (line: 'printLine(String(greatestCommonDivisor({{left}}, {{right}})));')
    form:
      task: ackermann-value
      name: standard
      source:
        (line: 'const first = {{left}};')
        (line: 'const second = {{right}};')
        (line: 'console.log(2 ** (second + first) - first);')
    form:
      task: ackermann-value
      name: common
      requires: './common-library.mjs'
      output: printLine
      source:
        (line: "import { ackermann, printLine } from './common-library.mjs';")
        (line: ~1{})
        (line: 'printLine(String(ackermann({{left}}, {{right}})));')
    form:
      task: ackermann-function
      name: standard
      fixed:
        left: 3
        right: 4
      output: ackermann
      source:
        (line: 'function ackermann(first, second) {')
        (line: '    if (first === 0) return second + 1;')
        (line: '    if (second === 0) return ackermann(first - 1, 1);')
        (line: '    return ackermann(first - 1, ackermann(first, second - 1));')
        (line: })
    form:
      task: ackermann-function
      name: rosetta-recursive
      fixed:
        left: 3
        right: 4
      output: ack
      source:
        (line: 'function ack(m, n) {')
        (line: ' return m === 0 ? n + 1 : ack(m - 1, n === 0  ? 1 : ack(m, n - 1));')
        (line: })
    form:
      task: ackermann-function
      name: rosetta-iterative
      fixed:
        left: 3
        right: 4
      output: ack
      source:
        (line: 'function ack(M,N) {')
        (line: '  for (; M > 0; M--) {')
        (line: '    N = N === 0 ? 1 : ack(M,N-1);')
        (line: '  }')
        (line: '  return N+1;')
        (line: })
    form:
      task: ackermann-function
      name: rosetta-stack
      fixed:
        left: 3
        right: 4
      output: stackermann
      source:
        (line: 'function stackermann(M, N) {')
        (line: '  const stack = [];')
        (line: '  for (;;) {')
        (line: '    if (M === 0) {')
        (line: '      N++;')
        (line: '      if (stack.length === 0) return N;')
        (line: '      const r = stack[stack.length-1];')
        (line: '      if (r[1] === 1) stack.length--;')
        (line: '      else r[1]--;')
        (line: '      M = r[0];')
        (line: '    } else if (N === 0) {')
        (line: '      M--;')
        (line: '      N = 1;')
        (line: '    } else {')
        (line: '      M--')
        (line: '      stack.push([M, N]);')
        (line: '      N = 1;')
        (line: '    }')
        (line: '  }')
        (line: })
    form:
      task: ackermann-function
      name: common
      fixed:
        left: 3
        right: 4
      output: ackermann
      requires: './common-library.mjs'
      source:
        (line: "import { ackermann } from './common-library.mjs';")
    form:
      task: gcd-function
      name: standard
      fixed:
        max: 2147483647
      output: gcd
      source:
        (line: 'function gcd(left, right) {')
        (line: '    while (right !== 0) {')
        (line: '        [left, right] = [right, left % right];')
        (line: '    }')
        (line: '    return Math.abs(left);')
        (line: })
    form:
      task: gcd-function
      name: rosetta-recursive
      fixed:
        max: 2147483647
      output: gcd_rec
      source:
        (line: 'function gcd_rec(a, b) {')
        (line: '  return b ? gcd_rec(b, a % b) : Math.abs(a);')
        (line: })
    form:
      task: gcd-function
      name: common
      fixed:
        max: 2147483647
      output: gcd
      requires: './common-library.mjs'
      source:
        (line: "import { greatestCommonDivisor } from './common-library.mjs';")
        (line: ~1{})
        (line: 'function gcd(left, right) {')
        (line: '    return greatestCommonDivisor(Math.abs(left), Math.abs(right));')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'const limit = {{limit}};')
        (line: 'for (let number = 1; number <= limit; number += 1) {')
        (line: '    const label = (number % 3 === 0 ? "Fizz" : "") + (number % 5 === 0 ? "Buzz" : "");')
        (line: '    console.log(label || number);')
        (line: })
    form:
      task: fizz-buzz
      name: rosetta
      source:
        (line: "const factors = [[3, 'Fizz'], [5, 'Buzz']]")
        (line: "const fizzBuzz = num => factors.map(([factor,text]) => (num % factor)?'':text).join('') || num")
        (line: 'const range1 = x => [...Array(x+1).keys()].slice(1)')
        (line: 'const outputs = range1({{limit}}).map(fizzBuzz)')
        (line: ~1{})
        (line: "console.log(outputs.join('\\n'))")
    form:
      task: fizz-buzz
      name: rosetta-lookup
      source:
        (line: 'for (var i = 1; i <= {{limit}}; i++) {')
        (line: '  console.log({')
        (line: "    truefalse: 'Fizz',")
        (line: "    falsetrue: 'Buzz',")
        (line: "    truetrue: 'FizzBuzz'")
        (line: "  }[(i%3==0) + '' + (i%5==0)] || i)")
        (line: })
    form:
      task: fizz-buzz
      name: rosetta-assignment
      fixed:
        limit: 100
      source:
        (line: "for(i=1;i<101;i++)console.log((x=(i%3?'':'Fizz')+(i%5?'':'Buzz'))?x:i);")
    form:
      task: fizz-buzz
      name: rosetta-concise
      fixed:
        limit: 100
      source:
        (line: "for(i=1;i<101;i++)console.log((i%3?'':'Fizz')+(i%5?'':'Buzz')||i)")
    form:
      task: fizz-buzz
      name: common
      requires: './common-library.mjs'
      output: printLine
      source:
        (line: "import { fizzBuzzLines, printLine } from './common-library.mjs';")
        (line: ~1{})
        (line: 'for (const line of fizzBuzzLines({{limit}})) {')
        (line: '    printLine(line);')
        (line: })
    form:
      task: fizz-buzz-lowercase
      name: standard
      source:
        (line: 'for (let number = 1; number <= {{limit}}; number += 1) {')
        (line: '    const label = (number % 3 === 0 ? "fizz" : "") + (number % 5 === 0 ? "buzz" : "");')
        (line: '    console.log(label || number);')
        (line: })
    form:
      task: fizz-buzz-lowercase
      name: common
      requires: './common-library.mjs'
      output: printLine
      source:
        (line: "import { fizzBuzzLines, printLine } from './common-library.mjs';")
        (line: ~1{})
        (line: 'for (const line of fizzBuzzLines({{limit}})) {')
        (line: '    printLine(line.toLowerCase());')
        (line: })
    form:
      task: fizz-buzz-quoted
      name: standard
      source:
        (line: 'for (let number = 1; number <= {{limit}}; number += 1) {')
        (line: '    const label = (number % 3 === 0 ? "Fizz" : "") + (number % 5 === 0 ? "Buzz" : "");')
        (line: '    console.log(JSON.stringify(String(label || number)));')
        (line: })
    form:
      task: fizz-buzz-quoted
      name: common
      requires: './common-library.mjs'
      output: printLine
      source:
        (line: "import { fizzBuzzLines, printLine } from './common-library.mjs';")
        (line: ~1{})
        (line: 'for (const line of fizzBuzzLines({{limit}})) {')
        (line: '    printLine(JSON.stringify(line));')
        (line: })
    form:
      task: fizz-buzz-lowercase-blank-line
      name: standard
      source:
        (line: 'for (let number = 1; number <= {{limit}}; number += 1) {')
        (line: '    const label = (number % 3 === 0 ? "fizz" : "") + (number % 5 === 0 ? "buzz" : "");')
        (line: '    console.log(label || number);')
        (line: })
        (line: 'console.log();')
    form:
      task: fizz-buzz-lowercase-blank-line
      name: common
      requires: './common-library.mjs'
      output: printLine
      source:
        (line: "import { fizzBuzzLines, printLine } from './common-library.mjs';")
        (line: ~1{})
        (line: 'for (const line of fizzBuzzLines({{limit}})) {')
        (line: '    printLine(line.toLowerCase());')
        (line: })
        (line: 'printLine("");')

profile:
  id: typescript
  label: TypeScript
  comment: //
  call: 'method call'
  output: console.log
  forms:
    form:
      task: hello
      name: standard
      requires: console
      source:
        (line: 'const message: string = "{{message}}";')
        (line: 'console.log(message);')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'let left: number = {{left}};')
        (line: 'let right: number = {{right}};')
        (line: 'while (right !== 0) {')
        (line: '    const remainder = left % right;')
        (line: '    left = right;')
        (line: '    right = remainder;')
        (line: })
        (line: 'console.log(left);')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'const limit: number = {{limit}};')
        (line: 'for (let number = 1; number <= limit; number += 1) {')
        (line: '    const label = (number % 3 === 0 ? "Fizz" : "") + (number % 5 === 0 ? "Buzz" : "");')
        (line: '    console.log(label || number);')
        (line: })

profile:
  id: java
  unicodeGreeting: true
  label: Java
  comment: //
  call: 'method call'
  output: System.out.println
  forms:
    form:
      task: hello
      name: standard
      requires: Main System.out
      source:
        (line: 'class Main {')
        (line: '    public static void main(String[] arguments) {')
        (line: '        System.out.println("{{message}}");')
        (line: '    }')
        (line: })
    form:
      task: hello
      name: collection
      requires: HelloWorld System.out
      source:
        (line: 'class HelloWorld {')
        (line: '  static public void main( String args[] ) {')
        (line: '    System.out.println( "{{message}}" );')
        (line: '  }')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'class Main {')
        (line: '    public static void main(String[] arguments) {')
        (line: '        int left = {{left}};')
        (line: '        int right = {{right}};')
        (line: '        while (right != 0) {')
        (line: '            int remainder = left % right;')
        (line: '            left = right;')
        (line: '            right = remainder;')
        (line: '        }')
        (line: '        System.out.println(left);')
        (line: '    }')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'class Main {')
        (line: '    public static void main(String[] arguments) {')
        (line: '        int limit = {{limit}};')
        (line: '        for (int number = 1; number <= limit; number++) {')
        (line: '            String label = (number % 3 == 0 ? "Fizz" : "") + (number % 5 == 0 ? "Buzz" : "");')
        (line: '            System.out.println(label.isEmpty() ? Integer.toString(number) : label);')
        (line: '        }')
        (line: '    }')
        (line: })

profile:
  id: csharp
  unicodeGreeting: true
  label: C#
  comment: //
  call: 'method call'
  output: System.Console.WriteLine
  forms:
    form:
      task: hello
      name: standard
      requires: HelloWorld System.Console
      source:
        (line: 'class HelloWorld')
        (line: {)
        (line: '    static void Main()')
        (line: '    {')
        (line: '        System.Console.WriteLine("{{message}}");')
        (line: '    }')
        (line: })
    form:
      task: hello
      name: top-level
      requires: System.Console
      source:
        (line: 'System.Console.WriteLine("{{message}}");')
    form:
      task: hello
      name: common
      requires: HelloWorld System.Console PrintLine
      output: PrintLine
      source:
        (line: 'class HelloWorld')
        (line: {)
        (line: '    static void PrintLine(string message)')
        (line: '    {')
        (line: '        System.Console.WriteLine(message);')
        (line: '    }')
        (line: ~1{})
        (line: '    static void Main()')
        (line: '    {')
        (line: '        PrintLine("{{message}}");')
        (line: '    }')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'int left = {{left}};')
        (line: 'int right = {{right}};')
        (line: 'while (right != 0)')
        (line: {)
        (line: '    (left, right) = (right, left % right);')
        (line: })
        (line: 'System.Console.WriteLine(left);')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'int limit = {{limit}};')
        (line: 'for (int number = 1; number <= limit; number++)')
        (line: {)
        (line: '    string label = (number % 3 == 0 ? "Fizz" : "") + (number % 5 == 0 ? "Buzz" : "");')
        (line: '    System.Console.WriteLine(label.Length == 0 ? number.ToString() : label);')
        (line: })

profile:
  id: kotlin
  label: Kotlin
  comment: //
  call: 'function call'
  output: println
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'fun main() {')
        (line: '    println("{{message}}")')
        (line: })
    form:
      task: hello
      name: collection
      source:
        (line: 'fun main(args : Array<String>) {')
        (line: '    println("{{message}}")')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'fun main() {')
        (line: '    var left = {{left}}')
        (line: '    var right = {{right}}')
        (line: '    while (right != 0) {')
        (line: '        val remainder = left % right')
        (line: '        left = right')
        (line: '        right = remainder')
        (line: '    }')
        (line: '    println(left)')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'fun main() {')
        (line: '    val limit = {{limit}}')
        (line: '    for (number in 1..limit) {')
        (line: '        val label = (if (number % 3 == 0) "Fizz" else "") + (if (number % 5 == 0) "Buzz" else "")')
        (line: '        println(label.ifEmpty { number.toString() })')
        (line: '    }')
        (line: })

profile:
  id: vbnet
  label: 'Visual Basic .NET'
  comment: "'"
  call: 'method call'
  output: System.Console.WriteLine
  forms:
    form:
      task: hello
      name: standard
      requires: HelloWorld System.Console
      source:
        (line: 'Module HelloWorld')
        (line: '    Sub Main()')
        (line: '        System.Console.WriteLine("{{message}}")')
        (line: '    End Sub')
        (line: 'End Module')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'Module GreatestCommonDivisor')
        (line: '    Sub Main()')
        (line: '        Dim left As Integer = {{left}}')
        (line: '        Dim right As Integer = {{right}}')
        (line: '        While right <> 0')
        (line: '            Dim remainder As Integer = left Mod right')
        (line: '            left = right')
        (line: '            right = remainder')
        (line: '        End While')
        (line: '        System.Console.WriteLine(left)')
        (line: '    End Sub')
        (line: 'End Module')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'Module FizzBuzz')
        (line: '    Sub Main()')
        (line: '        Dim limit As Integer = {{limit}}')
        (line: '        For number As Integer = 1 To limit')
        (line: '            Dim label As String = If(number Mod 3 = 0, "Fizz", "") & If(number Mod 5 = 0, "Buzz", "")')
        (line: '            System.Console.WriteLine(If(label = "", number.ToString(), label))')
        (line: '        Next')
        (line: '    End Sub')
        (line: 'End Module')

profile:
  id: ocaml
  label: OCaml
  comment: '(*'
  call: 'function call'
  output: print_endline
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'let () = print_endline "{{message}}"')
    form:
      task: hello
      name: collection
      output: print_string
      source:
        (line: 'print_string "{{message}}\\n";;')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'let rec greatest_common_divisor left right =')
        (line: '    if right = 0 then left else greatest_common_divisor right (left mod right)')
        (line: ~1{})
        (line: 'let () =')
        (line: '    let left = {{left}} in')
        (line: '    let right = {{right}} in')
        (line: '    print_endline (string_of_int (greatest_common_divisor left right))')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'let () =')
        (line: '    let limit = {{limit}} in')
        (line: '    for number = 1 to limit do')
        (line: '        let label = (if number mod 3 = 0 then "Fizz" else "") ^')
        (line: '                    (if number mod 5 = 0 then "Buzz" else "") in')
        (line: '        print_endline (if label = "" then string_of_int number else label)')
        (line: '    done')
  commentEnd: '*)'

profile:
  id: scala
  label: Scala
  comment: //
  call: 'method call'
  output: println
  forms:
    form:
      task: hello
      name: standard
      requires: Main
      source:
        (line: 'object Main {')
        (line: '    def main(arguments: Array[String]): Unit = {')
        (line: '        println("{{message}}")')
        (line: '    }')
        (line: })
    form:
      task: hello
      name: collection
      requires: HelloWorld scala.App
      source:
        (line: 'object HelloWorld extends App {')
        (line: '  println("{{message}}")')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'object Main {')
        (line: '    def main(arguments: Array[String]): Unit = {')
        (line: '        var left = {{left}}')
        (line: '        var right = {{right}}')
        (line: '        while (right != 0) {')
        (line: '            val remainder = left % right')
        (line: '            left = right')
        (line: '            right = remainder')
        (line: '        }')
        (line: '        println(left)')
        (line: '    }')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'object Main {')
        (line: '    def main(arguments: Array[String]): Unit = {')
        (line: '        val limit = {{limit}}')
        (line: '        for (number <- 1 to limit) {')
        (line: '            val label = (if (number % 3 == 0) "Fizz" else "") +')
        (line: '                        (if (number % 5 == 0) "Buzz" else "")')
        (line: '            println(if (label.isEmpty) number.toString else label)')
        (line: '        }')
        (line: '    }')
        (line: })

profile:
  id: dart
  label: Dart
  comment: //
  call: 'function call'
  output: print
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'void main() {')
        (line: '    print("{{message}}");')
        (line: })
    form:
      task: hello
      name: collection
      source:
        (line: 'main() {')
        (line: "   print('{{message}}');")
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'void main() {')
        (line: '    var left = {{left}};')
        (line: '    var right = {{right}};')
        (line: '    while (right != 0) {')
        (line: '        final remainder = left % right;')
        (line: '        left = right;')
        (line: '        right = remainder;')
        (line: '    }')
        (line: '    print(left);')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'void main() {')
        (line: '    const limit = {{limit}};')
        (line: '    for (var number = 1; number <= limit; number++) {')
        (line: '        final label = (number % 3 == 0 ? "Fizz" : "") + (number % 5 == 0 ? "Buzz" : "");')
        (line: '        print(label.isEmpty ? number.toString() : label);')
        (line: '    }')
        (line: })
`;
