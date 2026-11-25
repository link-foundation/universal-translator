// Greatest common divisor in Zig, using the Euclidean algorithm

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn greatestCommonDivisor(initial_first: i64, initial_second: i64) i64 {
    var first: i64 = initial_first;
    var second: i64 = initial_second;
    while (second != 0) {
        const remainder: i64 = @rem(first, second);
        first = second;
        second = remainder;
    }
    return first;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    out.print("The greatest common divisor of 1071 and 462 is {d}\n", .{greatestCommonDivisor(1071, 462)}) catch {};
}
