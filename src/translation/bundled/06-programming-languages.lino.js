// Generated from ../data/06-programming-languages.lino.
export default `profile:
  id: erlang
  label: Erlang
  comment: %
  header: 1
  call: 'function call'
  output: 'io:format'
  forms:
    form:
      task: hello
      name: standard
      requires: escript
      source:
        (line: '#!/usr/bin/env escript')
        (line: ~1{})
        (line: 'main(_) ->')
        (line: '    io:format("~s~n", ["{{message}}"]).')
    form:
      task: greatest-common-divisor
      name: standard
      requires: escript
      source:
        (line: '#!/usr/bin/env escript')
        (line: ~1{})
        (line: 'greatest_common_divisor(Left, 0) -> Left;')
        (line: 'greatest_common_divisor(Left, Right) ->')
        (line: '    greatest_common_divisor(Right, Left rem Right).')
        (line: ~1{})
        (line: 'main(_) ->')
        (line: '    io:format("~B~n", [greatest_common_divisor({{left}}, {{right}})]).')
    form:
      task: fizz-buzz
      name: standard
      requires: escript
      source:
        (line: '#!/usr/bin/env escript')
        (line: ~1{})
        (line: 'fizz_buzz(Number) when Number rem 15 =:= 0 -> "FizzBuzz";')
        (line: 'fizz_buzz(Number) when Number rem 3 =:= 0 -> "Fizz";')
        (line: 'fizz_buzz(Number) when Number rem 5 =:= 0 -> "Buzz";')
        (line: 'fizz_buzz(Number) -> integer_to_list(Number).')
        (line: ~1{})
        (line: 'main(_) ->')
        (line: '    lists:foreach(')
        (line: '        fun(Number) -> io:format("~s~n", [fizz_buzz(Number)]) end,')
        (line: '        lists:seq(1, {{limit}})')
        (line: '    ).')

profile:
  id: elixir
  label: Elixir
  comment: '#'
  call: 'function call'
  output: IO.puts
  forms:
    form:
      task: hello
      name: standard
      requires: 'Elixir standard library'
      source:
        (line: 'IO.puts("{{message}}")')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Elixir standard library'
      source:
        (line: 'defmodule Arithmetic do')
        (line: '  def greatest_common_divisor(left, 0), do: left')
        (line: ~1{})
        (line: '  def greatest_common_divisor(left, right) do')
        (line: '    greatest_common_divisor(right, rem(left, right))')
        (line: '  end')
        (line: end)
        (line: ~1{})
        (line: 'IO.puts(Arithmetic.greatest_common_divisor({{left}}, {{right}}))')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Elixir standard library'
      source:
        (line: 'for number <- 1..{{limit}} do')
        (line: '  result =')
        (line: '    cond do')
        (line: '      rem(number, 15) == 0 -> "FizzBuzz"')
        (line: '      rem(number, 3) == 0 -> "Fizz"')
        (line: '      rem(number, 5) == 0 -> "Buzz"')
        (line: '      true -> number')
        (line: '    end')
        (line: ~1{})
        (line: '  IO.puts(result)')
        (line: end)

profile:
  id: fsharp
  label: F#
  comment: //
  call: 'function call'
  output: printfn
  forms:
    form:
      task: hello
      name: standard
      requires: 'F# Interactive'
      source:
        (line: 'printfn "%s" "{{message}}"')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'F# Interactive'
      source:
        (line: 'let rec greatestCommonDivisor left right =')
        (line: '    if right = 0 then left')
        (line: '    else greatestCommonDivisor right (left % right)')
        (line: ~1{})
        (line: 'printfn "%d" (greatestCommonDivisor {{left}} {{right}})')
    form:
      task: fizz-buzz
      name: standard
      requires: 'F# Interactive'
      source:
        (line: 'for number in 1 .. {{limit}} do')
        (line: '    if number % 15 = 0 then printfn "FizzBuzz"')
        (line: '    elif number % 3 = 0 then printfn "Fizz"')
        (line: '    elif number % 5 = 0 then printfn "Buzz"')
        (line: '    else printfn "%d" number')

profile:
  id: groovy
  label: Groovy
  comment: //
  call: 'function call'
  output: println
  forms:
    form:
      task: hello
      name: standard
      requires: 'Groovy standard library'
      source:
        (line: "println '{{message}}'")
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Groovy standard library'
      source:
        (line: 'int left = {{left}}')
        (line: 'int right = {{right}}')
        (line: 'while (right != 0) {')
        (line: '    int remainder = left % right')
        (line: '    left = right')
        (line: '    right = remainder')
        (line: })
        (line: 'println left')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Groovy standard library'
      source:
        (line: 'for (int number in 1..{{limit}}) {')
        (line: "    if (number % 15 == 0) println 'FizzBuzz'")
        (line: "    else if (number % 3 == 0) println 'Fizz'")
        (line: "    else if (number % 5 == 0) println 'Buzz'")
        (line: '    else println number')
        (line: })

profile:
  id: raku
  label: Raku
  comment: '#'
  call: 'function call'
  output: say
  forms:
    form:
      task: hello
      name: standard
      requires: Rakudo
      source:
        (line: "say '{{message}}';")
    form:
      task: greatest-common-divisor
      name: standard
      requires: Rakudo
      source:
        (line: 'my ($left, $right) = {{left}}, {{right}};')
        (line: 'while $right != 0 {')
        (line: '    ($left, $right) = $right, $left % $right;')
        (line: })
        (line: 'say $left;')
    form:
      task: fizz-buzz
      name: standard
      requires: Rakudo
      source:
        (line: 'for 1..{{limit}} -> $number {')
        (line: "    if $number % 15 == 0 { say 'FizzBuzz'; }")
        (line: "    elsif $number % 3 == 0 { say 'Fizz'; }")
        (line: "    elsif $number % 5 == 0 { say 'Buzz'; }")
        (line: '    else { say $number; }')
        (line: })

profile:
  id: scheme
  label: 'Scheme (GNU Guile)'
  comment: ;
  call: 'function call'
  output: display
  forms:
    form:
      task: hello
      name: standard
      requires: 'Scheme standard library'
      source:
        (line: '(display "{{message}}")')
        (line: '(newline)')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Scheme standard library'
      source:
        (line: '(define (greatest-common-divisor left right)')
        (line: '  (if (= right 0)')
        (line: '      left')
        (line: '      (greatest-common-divisor right (modulo left right))))')
        (line: ~1{})
        (line: '(display (greatest-common-divisor {{left}} {{right}}))')
        (line: '(newline)')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Scheme standard library'
      source:
        (line: '(define (fizz-buzz number)')
        (line: '  (cond')
        (line: '    ((= (modulo number 15) 0) "FizzBuzz")')
        (line: '    ((= (modulo number 3) 0) "Fizz")')
        (line: '    ((= (modulo number 5) 0) "Buzz")')
        (line: '    (else (number->string number))))')
        (line: ~1{})
        (line: '(do ((number 1 (+ number 1)))')
        (line: '    ((> number {{limit}}))')
        (line: '  (display (fizz-buzz number))')
        (line: '  (newline))')

profile:
  id: nim
  label: Nim
  comment: '#'
  call: 'function call'
  output: echo
  forms:
    form:
      task: hello
      name: standard
      requires: 'Nim standard library'
      source:
        (line: 'echo "{{message}}"')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Nim standard library'
      source:
        (line: 'var left = {{left}}')
        (line: 'var right = {{right}}')
        (line: 'while right != 0:')
        (line: '  let remainder = left mod right')
        (line: '  left = right')
        (line: '  right = remainder')
        (line: 'echo left')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Nim standard library'
      source:
        (line: 'for number in 1 .. {{limit}}:')
        (line: '  if number mod 15 == 0:')
        (line: '    echo "FizzBuzz"')
        (line: '  elif number mod 3 == 0:')
        (line: '    echo "Fizz"')
        (line: '  elif number mod 5 == 0:')
        (line: '    echo "Buzz"')
        (line: '  else:')
        (line: '    echo number')

profile:
  id: haxe
  label: Haxe
  comment: //
  call: 'function call'
  output: Sys.println
  forms:
    form:
      task: hello
      name: standard
      requires: 'Haxe interpreter'
      source:
        (line: 'class Main {')
        (line: '    static function main() {')
        (line: '        Sys.println("{{message}}");')
        (line: '    }')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Haxe interpreter'
      source:
        (line: 'class Main {')
        (line: '    static function main() {')
        (line: '        var left = {{left}};')
        (line: '        var right = {{right}};')
        (line: '        while (right != 0) {')
        (line: '            var remainder = left % right;')
        (line: '            left = right;')
        (line: '            right = remainder;')
        (line: '        }')
        (line: '        Sys.println(left);')
        (line: '    }')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      requires: 'Haxe interpreter'
      source:
        (line: 'class Main {')
        (line: '    static function main() {')
        (line: '        for (number in 1...({{limit}} + 1)) {')
        (line: '            if (number % 15 == 0) Sys.println("FizzBuzz");')
        (line: '            else if (number % 3 == 0) Sys.println("Fizz");')
        (line: '            else if (number % 5 == 0) Sys.println("Buzz");')
        (line: '            else Sys.println(number);')
        (line: '        }')
        (line: '    }')
        (line: })

profile:
  id: crystal
  label: Crystal
  comment: '#'
  call: 'function call'
  output: puts
  forms:
    form:
      task: hello
      name: standard
      requires: 'Crystal standard library'
      source:
        (line: 'puts "{{message}}"')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Crystal standard library'
      source:
        (line: 'left = {{left}}')
        (line: 'right = {{right}}')
        (line: 'while right != 0')
        (line: '  left, right = right, left % right')
        (line: end)
        (line: 'puts left')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Crystal standard library'
      source:
        (line: '(1..{{limit}}).each do |number|')
        (line: '  if number % 15 == 0')
        (line: '    puts "FizzBuzz"')
        (line: '  elsif number % 3 == 0')
        (line: '    puts "Fizz"')
        (line: '  elsif number % 5 == 0')
        (line: '    puts "Buzz"')
        (line: '  else')
        (line: '    puts number')
        (line: '  end')
        (line: end)

profile:
  id: racket
  label: Racket
  comment: ;
  header: 1
  call: 'function call'
  output: displayln
  forms:
    form:
      task: hello
      name: standard
      requires: racket/base
      source:
        (line: '#lang racket/base')
        (line: ~1{})
        (line: '(displayln "{{message}}")')
    form:
      task: greatest-common-divisor
      name: standard
      requires: racket/base
      source:
        (line: '#lang racket/base')
        (line: ~1{})
        (line: '(define (greatest-common-divisor left right)')
        (line: '  (if (zero? right)')
        (line: '      left')
        (line: '      (greatest-common-divisor right (remainder left right))))')
        (line: ~1{})
        (line: '(displayln (greatest-common-divisor {{left}} {{right}}))')
    form:
      task: fizz-buzz
      name: standard
      requires: racket/base
      source:
        (line: '#lang racket/base')
        (line: ~1{})
        (line: '(for ([number (in-inclusive-range 1 {{limit}})])')
        (line: '  (displayln')
        (line: '   (cond')
        (line: '     [(zero? (remainder number 15)) "FizzBuzz"]')
        (line: '     [(zero? (remainder number 3)) "Fizz"]')
        (line: '     [(zero? (remainder number 5)) "Buzz"]')
        (line: '     [else number])))')

profile:
  id: fish
  label: 'Fish shell'
  comment: '#'
  call: 'function call'
  output: printf
  forms:
    form:
      task: hello
      name: standard
      requires: 'fish shell and seq'
      source:
        (line: "printf '%s\\n' '{{message}}'")
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'fish shell and seq'
      source:
        (line: 'set left {{left}}')
        (line: 'set right {{right}}')
        (line: 'while test "$right" -ne 0')
        (line: '    set remainder (math "$left % $right")')
        (line: '    set left "$right"')
        (line: '    set right "$remainder"')
        (line: end)
        (line: \`printf '%d\\n' "$left"\`)
    form:
      task: fizz-buzz
      name: standard
      requires: 'fish shell and seq'
      source:
        (line: 'for number in (seq 1 {{limit}})')
        (line: '    if test (math "$number % 15") -eq 0')
        (line: "        printf '%s\\n' FizzBuzz")
        (line: '    else if test (math "$number % 3") -eq 0')
        (line: "        printf '%s\\n' Fizz")
        (line: '    else if test (math "$number % 5") -eq 0')
        (line: "        printf '%s\\n' Buzz")
        (line: '    else')
        (line: \`        printf '%d\\n' "$number"\`)
        (line: '    end')
        (line: end)

`;
