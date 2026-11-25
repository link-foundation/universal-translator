// Primality by trial division in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn isPrime(number: i64) bool {
    if (number < 2) {
        return false;
    }
    var divisor: i64 = 2;
    while (divisor * divisor <= number) {
        if (@rem(number, divisor) == 0) {
            return false;
        }
        divisor += 1;
    }
    return true;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var number: i64 = 1;
    while (number <= 50) : (number += 1) {
        if (isPrime(number)) {
            out.print("{d}\n", .{number}) catch {};
        }
    }
}
