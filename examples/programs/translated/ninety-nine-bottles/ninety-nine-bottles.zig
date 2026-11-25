// 99 bottles of beer in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var bottles: i64 = 99;
    while (bottles > 0) {
        out.print("{d} bottles of beer on the wall, {d} bottles of beer.\n", .{ bottles, bottles }) catch {};
        out.print("Take one down and pass it around, {d} bottles of beer on the wall.\n", .{bottles - 1}) catch {};
        bottles -= 1;
    }
}
