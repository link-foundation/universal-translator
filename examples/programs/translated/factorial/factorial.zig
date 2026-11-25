// Factorial in Zig, defined recursively

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn factorial(number: i64) i64 {
    if (number <= 1) {
        return 1;
    }
    return number * factorial(number - 1);
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var number: i64 = 0;
    while (number <= 10) : (number += 1) {
        out.print("{d}! = {d}\n", .{ number, factorial(number) }) catch {};
    }
}
