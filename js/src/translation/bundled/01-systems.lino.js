// Generated from data/01-systems.lino.
export default `profile:
  id: c
  unicodeGreeting: true
  label: C
  comment: //
  call: 'function call'
  output: printf
  forms:
    form:
      task: hello
      name: standard
      requires: stdio.h
      source:
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '    printf("{{message}}\\n");')
        (line: '    return 0;')
        (line: })
    form:
      task: hello
      name: classic
      requires: stdio.h
      source:
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'main()')
        (line: {)
        (line: '    printf("{{message}}\\n");')
        (line: })
    form:
      task: hello
      name: common
      requires: stdio.h print_line
      output: print_line
      source:
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'static void print_line(const char *message)')
        (line: {)
        (line: '    puts(message);')
        (line: })
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '    print_line("{{message}}");')
        (line: '    return 0;')
        (line: })
    form:
      task: hello
      name: collection
      requires: stdio.h stdlib.h
      output: puts
      source:
        (line: '#include <stdio.h>')
        (line: '#include <stdlib.h>')
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '  puts("{{message}}");')
        (line: '  return EXIT_SUCCESS;')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '    int left = {{left}};')
        (line: '    int right = {{right}};')
        (line: '    while (right != 0) {')
        (line: '        int remainder = left % right;')
        (line: '        left = right;')
        (line: '        right = remainder;')
        (line: '    }')
        (line: '    printf("%d\\n", left);')
        (line: '    return 0;')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '    const int limit = {{limit}};')
        (line: '    for (int number = 1; number <= limit; number++) {')
        (line: '        if (number % 15 == 0) {')
        (line: '            puts("FizzBuzz");')
        (line: '        } else if (number % 3 == 0) {')
        (line: '            puts("Fizz");')
        (line: '        } else if (number % 5 == 0) {')
        (line: '            puts("Buzz");')
        (line: '        } else {')
        (line: '            printf("%d\\n", number);')
        (line: '        }')
        (line: '    }')
        (line: '    return 0;')
        (line: })

profile:
  id: cpp
  unicodeGreeting: true
  label: C++
  comment: //
  call: 'function call'
  output: 'std::cout'
  forms:
    form:
      task: hello
      name: standard
      requires: iostream
      source:
        (line: '#include <iostream>')
        (line: ~1{})
        (line: 'int main()')
        (line: {)
        (line: \`    std::cout << "{{message}}" << '\\n';\`)
        (line: })
    form:
      task: hello
      name: collection
      requires: iostream
      source:
        (line: '#include <iostream>')
        (line: ~1{})
        (line: 'int main()')
        (line: {)
        (line: '    std::cout << "{{message}}" << std::endl;')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: '#include <iostream>')
        (line: ~1{})
        (line: 'int main()')
        (line: {)
        (line: '    int left = {{left}};')
        (line: '    int right = {{right}};')
        (line: '    while (right != 0) {')
        (line: '        const int remainder = left % right;')
        (line: '        left = right;')
        (line: '        right = remainder;')
        (line: '    }')
        (line: "    std::cout << left << '\\n';")
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '#include <iostream>')
        (line: ~1{})
        (line: 'int main()')
        (line: {)
        (line: '    const int limit = {{limit}};')
        (line: '    for (int number = 1; number <= limit; ++number) {')
        (line: '        if (number % 15 == 0) {')
        (line: '            std::cout << "FizzBuzz\\n";')
        (line: '        } else if (number % 3 == 0) {')
        (line: '            std::cout << "Fizz\\n";')
        (line: '        } else if (number % 5 == 0) {')
        (line: '            std::cout << "Buzz\\n";')
        (line: '        } else {')
        (line: "            std::cout << number << '\\n';")
        (line: '        }')
        (line: '    }')
        (line: })

profile:
  id: rust
  unicodeGreeting: true
  label: Rust
  comment: //
  call: 'function call'
  output: println!
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'fn main() {')
        (line: '    println!("{{message}}");')
        (line: })
    form:
      task: hello
      name: rosetta
      source:
        (line: 'fn main() {')
        (line: '   println!("{{message}}");')
        (line: })
    form:
      task: hello
      name: common
      requires: common_library
      output: 'common_library::print_line'
      source:
        (line: 'mod common_library;')
        (line: ~1{})
        (line: 'fn main() {')
        (line: '    common_library::print_line("{{message}}");')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'fn main() {')
        (line: '    let mut left = {{left}};')
        (line: '    let mut right = {{right}};')
        (line: '    while right != 0 {')
        (line: '        (left, right) = (right, left % right);')
        (line: '    }')
        (line: '    println!("{left}");')
        (line: })
    form:
      task: greatest-common-divisor
      name: common
      requires: common_library
      output: 'common_library::print_line'
      source:
        (line: 'mod common_library;')
        (line: ~1{})
        (line: 'fn main() {')
        (line: '    let divisor = common_library::greatest_common_divisor({{left}}, {{right}});')
        (line: '    common_library::print_line(&divisor.to_string());')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'fn main() {')
        (line: '    let limit = {{limit}};')
        (line: '    for number in 1..=limit {')
        (line: '        match (number % 3 == 0, number % 5 == 0) {')
        (line: '            (true, true) => println!("FizzBuzz"),')
        (line: '            (true, false) => println!("Fizz"),')
        (line: '            (false, true) => println!("Buzz"),')
        (line: '            (false, false) => println!("{number}"),')
        (line: '        }')
        (line: '    }')
        (line: })
    form:
      task: fizz-buzz
      name: common
      requires: common_library
      output: 'common_library::print_line'
      source:
        (line: 'mod common_library;')
        (line: ~1{})
        (line: 'fn main() {')
        (line: '    for line in common_library::fizz_buzz_lines({{limit}}) {')
        (line: '        common_library::print_line(&line);')
        (line: '    }')
        (line: })

profile:
  id: go
  unicodeGreeting: true
  label: Go
  comment: //
  call: 'function call'
  output: fmt.Println
  forms:
    form:
      task: hello
      name: standard
      requires: fmt
      source:
        (line: 'package main')
        (line: ~1{})
        (line: 'import "fmt"')
        (line: ~1{})
        (line: 'func main() {')
        (line: '    fmt.Println("{{message}}")')
        (line: })
    form:
      task: hello
      name: collection
      requires: fmt
      output: fmt.Printf
      source:
        (line: 'package main')
        (line: 'import "fmt"')
        (line: 'func main() {')
        (line: ' fmt.Printf("{{message}}\\n")')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'package main')
        (line: ~1{})
        (line: 'import "fmt"')
        (line: ~1{})
        (line: 'func main() {')
        (line: '    left, right := {{left}}, {{right}}')
        (line: '    for right != 0 {')
        (line: '        left, right = right, left % right')
        (line: '    }')
        (line: '    fmt.Println(left)')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'package main')
        (line: ~1{})
        (line: 'import "fmt"')
        (line: ~1{})
        (line: 'func main() {')
        (line: '    limit := {{limit}}')
        (line: '    for number := 1; number <= limit; number++ {')
        (line: '        switch {')
        (line: '        case number%15 == 0:')
        (line: '            fmt.Println("FizzBuzz")')
        (line: '        case number%3 == 0:')
        (line: '            fmt.Println("Fizz")')
        (line: '        case number%5 == 0:')
        (line: '            fmt.Println("Buzz")')
        (line: '        default:')
        (line: '            fmt.Println(number)')
        (line: '        }')
        (line: '    }')
        (line: })

profile:
  id: swift
  label: Swift
  comment: //
  call: 'function call'
  output: print
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'print("{{message}}")')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'var left = {{left}}')
        (line: 'var right = {{right}}')
        (line: 'while right != 0 {')
        (line: '    (left, right) = (right, left % right)')
        (line: })
        (line: 'print(left)')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'let limit = {{limit}}')
        (line: 'for number in 1...limit {')
        (line: '    let label = (number % 3 == 0 ? "Fizz" : "") + (number % 5 == 0 ? "Buzz" : "")')
        (line: '    print(label.isEmpty ? String(number) : label)')
        (line: })

profile:
  id: fortran
  label: Fortran
  comment: !
  call: 'function call'
  output: write
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'program hello')
        (line: '    implicit none')
        (line: \`    write (*, '(A)') "{{message}}"\`)
        (line: 'end program hello')
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'program greatest_common_divisor')
        (line: '    implicit none')
        (line: '    integer :: left, right, remainder')
        (line: '    left = {{left}}')
        (line: '    right = {{right}}')
        (line: '    do while (right /= 0)')
        (line: '        remainder = mod(left, right)')
        (line: '        left = right')
        (line: '        right = remainder')
        (line: '    end do')
        (line: "    write (*, '(I0)') left")
        (line: 'end program greatest_common_divisor')
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'program fizz_buzz')
        (line: '    implicit none')
        (line: '    integer :: number, limit')
        (line: '    limit = {{limit}}')
        (line: '    do number = 1, limit')
        (line: '        if (mod(number, 15) == 0) then')
        (line: \`            write (*, '(A)') "FizzBuzz"\`)
        (line: '        else if (mod(number, 3) == 0) then')
        (line: \`            write (*, '(A)') "Fizz"\`)
        (line: '        else if (mod(number, 5) == 0) then')
        (line: \`            write (*, '(A)') "Buzz"\`)
        (line: '        else')
        (line: "            write (*, '(I0)') number")
        (line: '        end if')
        (line: '    end do')
        (line: 'end program fizz_buzz')

profile:
  id: pascal
  label: Pascal
  comment: //
  call: 'function call'
  output: WriteLn
  forms:
    form:
      task: hello
      name: standard
      source:
        (line: 'program Hello;')
        (line: begin)
        (line: "    WriteLn('{{message}}');")
        (line: end.)
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: 'program GreatestCommonDivisor;')
        (line: var)
        (line: '    left, right, remainder: LongInt;')
        (line: begin)
        (line: '    left := {{left}};')
        (line: '    right := {{right}};')
        (line: '    while right <> 0 do')
        (line: '    begin')
        (line: '        remainder := left mod right;')
        (line: '        left := right;')
        (line: '        right := remainder;')
        (line: '    end;')
        (line: '    WriteLn(left);')
        (line: end.)
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: 'program FizzBuzz;')
        (line: var)
        (line: '    number, limit: LongInt;')
        (line: begin)
        (line: '    limit := {{limit}};')
        (line: '    for number := 1 to limit do')
        (line: '        if number mod 15 = 0 then')
        (line: "            WriteLn('FizzBuzz')")
        (line: '        else if number mod 3 = 0 then')
        (line: "            WriteLn('Fizz')")
        (line: '        else if number mod 5 = 0 then')
        (line: "            WriteLn('Buzz')")
        (line: '        else')
        (line: '            WriteLn(number);')
        (line: end.)

profile:
  id: objective-c
  label: Objective-C
  comment: //
  call: 'function call'
  output: puts
  forms:
    form:
      task: hello
      name: standard
      requires: Foundation stdio.h
      source:
        (line: '#import <Foundation/Foundation.h>')
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '    NSAutoreleasePool *pool = [NSAutoreleasePool new];')
        (line: '    NSString *message = @"{{message}}";')
        (line: '    puts([message UTF8String]);')
        (line: '    [pool drain];')
        (line: '    return 0;')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      source:
        (line: '#import <Foundation/Foundation.h>')
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '    NSAutoreleasePool *pool = [NSAutoreleasePool new];')
        (line: '    int left = {{left}};')
        (line: '    int right = {{right}};')
        (line: '    while (right != 0) {')
        (line: '        int remainder = left % right;')
        (line: '        left = right;')
        (line: '        right = remainder;')
        (line: '    }')
        (line: '    NSString *result = [NSString stringWithFormat:@"%d", left];')
        (line: '    puts([result UTF8String]);')
        (line: '    [pool drain];')
        (line: '    return 0;')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      source:
        (line: '#import <Foundation/Foundation.h>')
        (line: '#include <stdio.h>')
        (line: ~1{})
        (line: 'int main(void)')
        (line: {)
        (line: '    NSAutoreleasePool *pool = [NSAutoreleasePool new];')
        (line: '    const int limit = {{limit}};')
        (line: '    for (int number = 1; number <= limit; number++) {')
        (line: '        NSString *fizz = number % 3 == 0 ? @"Fizz" : @"";')
        (line: '        NSString *buzz = number % 5 == 0 ? @"Buzz" : @"";')
        (line: '        NSString *label = [fizz stringByAppendingString:buzz];')
        (line: '        if ([label length] == 0) {')
        (line: '            label = [NSString stringWithFormat:@"%d", number];')
        (line: '        }')
        (line: '        puts([label UTF8String]);')
        (line: '    }')
        (line: '    [pool drain];')
        (line: '    return 0;')
        (line: })
`;
