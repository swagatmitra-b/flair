// the index file determines which authentication method is chosen and passes the function to that
// Debashish Buragohain

import { RequestHandler, Response } from "express";
import { siwsAuth } from "./siwsAuth";
import { web3Auth } from "./web3Auth";


