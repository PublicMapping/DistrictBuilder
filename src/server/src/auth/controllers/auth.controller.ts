import { PG_UNIQUE_VIOLATION } from "@drdgvhbh/postgres-error-codes";
import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException
} from "@nestjs/common";

import {
  LoginErrors,
  RegisterResponse,
  ResendResponse,
  VerifyEmailErrors
} from "../../../../shared/constants";
import { JWT } from "../../../../shared/entities";
import { Errors } from "../../../../shared/types";
import { UsersService } from "../../users/services/users.service";

import { LoginDto } from "../entities/login.dto";
import { RegisterDto } from "../entities/register.dto";
import { AuthService } from "../services/auth.service";

/*
 * Authentication service that handles logins, account activiation and
 * password maintenance.
 *
 * Pay careful attention when modifying this module to not unintentionally log
 * any passwords or hashes through stack traces or generated error messages.
 */
@Controller("api/auth")
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly userService: UsersService
  ) {}

  @Post("email/login")
  public async login(@Body() login: LoginDto): Promise<JWT> {
    try {
      const userOrError = await this.authService.validateLogin(login.email, login.password);
      if (userOrError === LoginErrors.NOT_FOUND) {
        throw new NotFoundException({
          error: LoginErrors.NOT_FOUND,
          message: { email: [`Email ${login.email} not found`] }
        } as Errors<LoginDto>);
      } else if (userOrError === LoginErrors.INVALID_PASSWORD) {
        throw new UnauthorizedException({
          error: LoginErrors.INVALID_PASSWORD,
          message: { password: ["Invalid password"] }
        } as Errors<LoginDto>);
      }
      return this.authService.generateJwt(userOrError);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        // Intentionally not logging errors as they may contain passwords
        this.logger.error(`Error logging user in`);
        throw new InternalServerErrorException("Unable to log in user");
      }
    }
  }

  @Post("email/register")
  async register(@Body() registerDto: RegisterDto): Promise<string> {
    try {
      const newUser = await this.userService.create(registerDto);
      await this.authService.sendVerificationEmail(newUser);
      return RegisterResponse.SUCCESS;
    } catch (error) {
      if (error.name === "QueryFailedError" && error.code === PG_UNIQUE_VIOLATION) {
        throw new BadRequestException({
          error: RegisterResponse.DUPLICATE,
          message: { email: [`User with email '${registerDto.email}' already exists`] }
        } as Errors<RegisterDto>);
      } else {
        // Intentionally not logging errors as they may contain passwords
        this.logger.error(`Error registering user`);
        throw new InternalServerErrorException();
      }
    }
  }

  @Post("email/verify/:token")
  public async verifyEmail(@Param("token") token: string): Promise<JWT> {
    try {
      const verifiedUser = await this.authService.verifyEmail(token);
      if (verifiedUser === undefined) {
        throw new NotFoundException(
          "Email or user not found for token",
          VerifyEmailErrors.NOT_FOUND
        );
      }
      return this.authService.generateJwt(verifiedUser);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        this.logger.error(`Error verifying email token: ${error}`);
        throw new InternalServerErrorException();
      }
    }
  }

  @Post("email/resend-verification/:email")
  public async sendEmailVerification(@Param("email") email: string): Promise<string> {
    try {
      const user = await this.userService.findOne({ email });
      if (!user) {
        throw new NotFoundException("User not found for this email", ResendResponse.NOT_FOUND);
      }
      await this.authService.sendVerificationEmail(user);
      return ResendResponse.SUCCESS;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      } else {
        this.logger.error(`Error sending email verification: ${error}`);
        throw new InternalServerErrorException();
      }
    }
  }
}
