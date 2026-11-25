// FizzBuzz in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var number: i64 = 1;
    while (number <= 100) : (number += 1) {
        if (@rem(number, 15) == 0) {
            out.print("FizzBuzz\n", .{}) catch {};
        } else if (@rem(number, 3) == 0) {
            out.print("Fizz\n", .{}) catch {};
        } else if (@rem(number, 5) == 0) {
            out.print("Buzz\n", .{}) catch {};
        } else {
            out.print("{d}\n", .{number}) catch {};
        }
    }
}
