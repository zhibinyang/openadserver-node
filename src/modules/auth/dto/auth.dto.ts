import { IsString, IsEmail, MinLength, MaxLength, IsOptional } from 'class-validator';

export class LoginDto {
    @IsString()
    @MinLength(3)
    @MaxLength(50)
    username!: string;

    @IsString()
    @MinLength(6)
    password!: string;
}

export class ChangePasswordDto {
    @IsString()
    @MinLength(6)
    oldPassword!: string;

    @IsString()
    @MinLength(6)
    newPassword!: string;
}

export class CreateUserDto {
    @IsString()
    @MinLength(3)
    @MaxLength(50)
    username!: string;

    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    password!: string;

    @IsString()
    @IsOptional()
    role?: string;
}

export class UpdateUserDto {
    @IsString()
    @MinLength(3)
    @MaxLength(50)
    @IsOptional()
    username?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    role?: string;

    @IsOptional()
    status?: number;
}
